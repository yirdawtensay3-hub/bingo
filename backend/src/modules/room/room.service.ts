import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Socket } from 'socket.io';
import {
  Room,
  RoomDocument,
  RoomStatus,
  RoomType,
} from '../../database/schema/room.schema';
import { GameSessionService } from '../gamesession/gamesession.service';
import { GameSession, GameSessionDocument } from 'src/database/schema/gamesession.schema';
import { GameSessionEventsService, SessionStatus } from '../gamesession/gamesession.events';
import { User, UserDocument } from 'src/database/schema/user.schema';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import {
  BingoBoard,
  BingoBoardDocument,
} from 'src/database/schema/bingoboard.schema';

interface CreateRoomDto {
  name: string;
  description?: string;
  createdBy: string | Types.ObjectId;
  houseCutPercent: number;
  maxPlayers?: number;
  minPlayers?: number;
  stake: number;
  hitsToWin?: number;
  waitingTime?: number;
  type?: RoomType;
  autoStart?: boolean;
  maxNoOfSessions?: number;
}

@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(GameSession.name)
    private readonly gameSessionModel: Model<GameSessionDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(BingoBoard.name)
    private bingoBoardModel: Model<BingoBoardDocument>,
    private readonly gameSessionService: GameSessionService,
    private readonly events: GameSessionEventsService,
    private readonly jwtService: JwtService,
  ) { }

  private readonly latestRoomCountdowns = new Map<string, Date>();

  async listRooms(): Promise<Room[]> {
    return this.roomModel
      .find({ type: RoomType.Public })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getMyRoom(userId: string): Promise<Room[]> {
    return this.roomModel
      .find({ createdBy: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getRoomById(roomId: string): Promise<Room> {
    const room = await this.roomModel.findById(roomId).lean();
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async getRoomByCode(code: string): Promise<Room> {
    const normalized = (code || '').trim().toUpperCase();
    const room = await this.roomModel.findOne({ roomCode: normalized }).lean();
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async createRoom(payload: CreateRoomDto, isAdmin: boolean): Promise<Room> {
    const code = this.generateRoomCode();
    const bingoBoards = await this.bingoBoardModel.find().limit(100).exec();
    if (!isAdmin) {
      const noOfRooms = await this.roomModel.countDocuments({ createdBy: new Types.ObjectId(payload.createdBy) }).exec();
      if (noOfRooms >= 1) {
        throw new BadRequestException('User already has a room');
      }
    }
    const created = await this.roomModel.create({
      name: payload.name,
      description: payload.description,
      createdBy: new Types.ObjectId(payload.createdBy),
      houseCutPercent: payload.houseCutPercent ?? 10,
      maxPlayers: payload.maxPlayers ?? 100,
      minPlayers: payload.minPlayers ?? 2,
      bingoBoards: bingoBoards.map((b) => b._id),
      stake: payload.stake,
      hitsToWin: payload.hitsToWin ?? 1,
      waitingTime: payload.waitingTime ?? 5000,
      type: payload.type ?? RoomType.Private,
      autoStart: payload.autoStart ?? false,
      maxNoOfSessions: payload.maxNoOfSessions ?? 1,
      roomCode: code,
    });
    return created.toObject();
  }

  async deleteRoom(roomId: string, userId: string, isAdmin: boolean): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    if ((room.createdBy as Types.ObjectId).toString() !== userId && isAdmin === false) {
      throw new BadRequestException('Only the room creator can delete the game');
    }

    await room.deleteOne();
    return room;
  }

  private generateRoomCode(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return code;
  }

  async startRoom(roomId: string, startedBy: string): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    // Only creator can start
    if ((room.createdBy as Types.ObjectId).toString() !== startedBy) {
      throw new BadRequestException('Only the room creator can start the game');
    }
    room.status = RoomStatus.Active;
    await room.save();
    return room.toObject();
  }

  async joinRoom(
    roomId: string,
    userId: string,
    client: Socket,
  ): Promise<{ session: GameSessionDocument; sessionToken: string }> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new WsException('Room not found');

    const userObjectId = new Types.ObjectId(userId);

    const existingUser = await this.userModel.findById(userObjectId);
    if (!existingUser) {
      throw new WsException({ status: 0, msg: 'User not found' });
    }

    if ((existingUser.main_balance + existingUser.reward_balance) < room.stake) {
      throw new WsException({
        status: 0,
        msg: 'Insufficient balance to join the room',
      });
    }

    const session = await this.gameSessionService.create(room, userId);

    await client.join(session.id);

    const player = session.users.find(
      (u) =>
        (u.userId as Types.ObjectId).toString() == existingUser._id.toString(),
    );

    if (!player) {
      const user = await this.userModel.findById(userId);
      if (!user) throw new WsException('User not found');

      session.users.push({
        userId: userObjectId,
        main_balance: user.main_balance,
        reward_balance: user.reward_balance,
        stake: 0,
        forfeited: false,
      });
      await session.save();

      const playerCount = session.users.filter((u) => !u.forfeited).length;
      this.events.emitSessionEvent(
        session.id,
        undefined,
        playerCount,
      );
    }

    const sessionToken = await this.jwtService.signAsync({
      sub: userId,
      sessionId: session.id,
      roomId: room.id,
      minPlayers: room.minPlayers,
      balance: (existingUser.main_balance + existingUser.reward_balance),
      stake: room.stake,
    });

    return {
      session: session.toObject(),
      sessionToken,
    };
  }

  async joinPrivate(
    roomCode: string,
    userId: string,
    client: Socket,
  ): Promise<{ session: GameSessionDocument; sessionToken: string }> {
    const room = await this.roomModel.findOne({ roomCode });
    if (!room) throw new WsException('Room not found');
    if (room.type !== RoomType.Private) {
      throw new WsException('Invalid room type');
    }
    return this.joinRoom(room.id, userId, client);
  }

  async updateStatus(roomId: string, status: RoomStatus): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    room.status = status;
    await room.save();
    return room.toObject();
  }

  async updateRoom(
    roomId: string,
    userId: string,
    isAdmin: boolean,
    updateData: {
      name?: string;
      description?: string;
      stake?: number;
      houseCutPercent?: number;
      maxPlayers?: number;
      minPlayers?: number;
      hitsToWin?: number;
      waitingTime?: number;
      type?: RoomType;
      autoStart?: boolean;
      maxNoOfSessions?: number;
    },
  ): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    // Only creator or admin can update
    if (!isAdmin && (room.createdBy as Types.ObjectId).toString() !== userId) {
      throw new BadRequestException('Only the room creator or admin can update the room');
    }

    // Check if room has active sessions
    if (room.status === RoomStatus.Active) {
      throw new BadRequestException('Cannot update an active room');
    }

    // Update fields if provided
    if (updateData.name !== undefined) room.name = updateData.name;
    if (updateData.description !== undefined) room.description = updateData.description;
    if (updateData.stake !== undefined) room.stake = updateData.stake;
    if (updateData.maxPlayers !== undefined) room.maxPlayers = updateData.maxPlayers;
    if (updateData.minPlayers !== undefined) room.minPlayers = updateData.minPlayers;
    if (updateData.hitsToWin !== undefined) room.hitsToWin = updateData.hitsToWin;
    if (updateData.waitingTime !== undefined) room.waitingTime = updateData.waitingTime;
    if (updateData.autoStart !== undefined) room.autoStart = updateData.autoStart;

    // Admin-only fields
    if (isAdmin) {
      if (updateData.houseCutPercent !== undefined) room.houseCutPercent = updateData.houseCutPercent;
      if (updateData.type !== undefined) room.type = updateData.type;
      if (updateData.maxNoOfSessions !== undefined) room.maxNoOfSessions = updateData.maxNoOfSessions;
    }

    await room.save();
    return room.toObject();
  }
}
