import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  GameSession,
  GameSessionDocument,
  Player,
} from '../../database/schema/gamesession.schema';
import { GameSessionEventsService, SessionStatus } from './gamesession.events';
import { Room, RoomDocument, RoomType } from 'src/database/schema/room.schema';
import {
  AssignedBoard,
  AssignedBoardDocument,
} from 'src/database/schema/assinedBoards.schema';
import { BingoBoardDocument } from 'src/database/schema/bingoboard.schema';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from 'src/database/schema/user.schema';
import {
  SessionTransaction,
  SessionTransactionDocument,
  SessionTransactionType,
} from 'src/database/schema/sTransaction.schema';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionStatus } from 'src/database/schema/transaction.schema';
import { AppGateway } from '../../app.gateway';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';

interface SessionState {
  roomId: string;
  assignedBoards: Map<string, Set<number>>;
  queue: (() => Promise<void>)[];
  processing: boolean;
  hitsToWin?: number;
  prize?: number;
  state: SessionStatus;
}

interface RoomBoards {
  boards: { boardId: Types.ObjectId; boardNumber: number; numbers: number[] }[];
}

@Injectable()
export class GameSessionService {
  constructor(
    @InjectModel(GameSession.name)
    private sessionModel: Model<GameSessionDocument>,
    @InjectModel(Room.name)
    private roomModel: Model<RoomDocument>,
    @InjectModel(AssignedBoard.name)
    private aBoardModel: Model<AssignedBoardDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(SessionTransaction.name)
    private sTransactionModel: Model<SessionTransactionDocument>,

    private events: GameSessionEventsService,
    private transaction: TransactionService,
    private readonly jwtService: JwtService,
    @Optional()
    @Inject(forwardRef(() => AppGateway))
    private readonly gateway?: AppGateway,
  ) {
    this.gateway = gateway;
    this.events.onSessionFinished().subscribe(({ sessionId, roomId }) => {
      this.handleSessionFinished(sessionId, roomId);
    });
  }

  private sessions: Map<string, SessionState> = new Map();
  private boardIds: Map<string, RoomBoards> = new Map();
  private countdownTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly latestRoomCountdowns = new Map<string, Date>();

  initSession(roomId: string, sessionId: string, userId: string, hitsToWin: number) {
    this.sessions.set(sessionId, {
      roomId: roomId,
      assignedBoards: new Map([[userId, new Set()]]),
      queue: [],
      processing: false,
      hitsToWin,
      state: SessionStatus.Waiting,
    });
  }

  initRoomBoards(roomId: string, boards: BingoBoardDocument[]) {
    this.boardIds.set(roomId, {
      boards: boards.map((b) => ({
        boardId: b._id as Types.ObjectId,
        boardNumber: b.boardId,
        numbers: b.numbers,
      })),
    });
  }

  enqueue(sessionToken: string, fn: () => Promise<void>) {
    let payload: {
      sub: string;
      sessionId: string;
      roomId: string;
      minPlayers: number;
      balance: number;
      stake: number;
    };
    try {
      payload = this.jwtService.verify(sessionToken);
      const state = this.sessions.get(payload.sessionId);
      if (!state) throw new WsException('Session state not found');

      state.queue.push(fn);
      if (!state.processing) this.processQueue(payload.sessionId);
    } catch (e) {
      console.warn(e);
      throw new WsException('Invalid session token');
    }
  }

  async getPublicRoomsWithLatestSessions(): Promise<any[]> {
    // Get all public rooms
    const publicRooms = await this.roomModel
      .find({ type: RoomType.Public })
      .select('-bingoBoards')
      .sort({ createdAt: -1 })
      .lean();

    // For each room, get the latest game session
    const roomsWithSessions = await Promise.all(
      publicRooms.map(async (room) => {
        const latestSession = await this.sessionModel
          .findOne({ room: room._id.toString(), status: { $ne: 'finished' } })
          .sort({ createdAt: -1 })
          .select('_id status calledCount stakePool willStart startedAt endedAt users createdAt updatedAt')
          .lean();

        // Calculate player count and enhanced status
        let playerCount = 0;
        let enhancedStatus = 'waiting';
        let sessionStartTime: Date | undefined = undefined;


        if (!latestSession) {
          return {
            ...room,
            latestSession: null,
          };
        }

        const lSession = this.sessions.get(latestSession._id.toString());
        if (!lSession) {
          return {
            ...room,
            latestSession: null,
          };
        }
        // Count non-forfeited players
        playerCount = latestSession.users?.filter((u: any) => !u.forfeited).length || 0;

        // Determine enhanced status
        latestSession.status = lSession?.state.toString() ?? 'waiting';
        if (latestSession.status === 'waiting') {
          if (playerCount === 0) {
            enhancedStatus = 'waiting'; // No players yet
          } else {
            enhancedStatus = 'filling'; // Players are joining
          }
        } else if (latestSession.status === 'countdown') {
          enhancedStatus = 'countdown';
        } else if (latestSession.status === 'active') {
          enhancedStatus = 'active'; // Game is live
        } else if (latestSession.status === 'finished') {
          enhancedStatus = 'finished'; // Game ended
        }

        if (lSession.state !== SessionStatus.Countdown) {
          this.events.latestRoomCountdowns.delete(lSession.roomId);
        }
        if (lSession.state == SessionStatus.Waiting || lSession.state == SessionStatus.Active) {
          this.events.latestRoomCountdowns.delete(lSession.roomId);
        }

        sessionStartTime = this.events.latestRoomCountdowns.get(room._id.toString())?.date ?? undefined;

        return {
          ...room,
          latestSession: latestSession ? {
            _id: latestSession._id,
            status: latestSession.status,
            enhancedStatus, // waiting | filling | active | finished
            calledCount: latestSession.calledCount,
            stakepool: (Array.from(lSession.assignedBoards.values())
              .reduce(
                (sum, boards) => sum + boards.size, 0
              ) * (room.stake || 0)
            ) * (1 - (room.houseCutPercent || 0) / 100),
            playerCount, // Number of active players
            willStart: latestSession.willStart,
            startedAt: sessionStartTime,
            endedAt: latestSession.endedAt,
            createdAt: (latestSession as any).createdAt,
            updatedAt: (latestSession as any).updatedAt,
          } : null,
        };
      }),
    );

    return roomsWithSessions;
  }

  private async processQueue(sessionId: string) {
    const state = this.sessions.get(sessionId);
    if (!state) throw new NotFoundException('Session state not found');

    if (state.queue.length === 0) {
      state.processing = false;
      return;
    }

    state.processing = true;
    const fn = state.queue.shift();
    if (!fn) return;
    try {
      await fn();
    } finally {
      this.processQueue(sessionId);
    }
  }

  private async handleSessionFinished(sessionId: string, _roomId: string) {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) return;

    session.status = 'finished';
    session.endedAt = new Date();
    await session.save();

    // const activeCount = await this.sessionModel.countDocuments({ roomId, status: 'active' });
    // const room = await this.roomModel.findById(roomId);
    // if (!room) return;
    //
    // if (activeCount === 0) {
    //   room.status = RoomStatus.Waiting;
    //   await room.save();
    // }
  }

  async create(room: RoomDocument, userId: string) {
    const roomId = room.id;
    const maxNoOfSessions = room.maxNoOfSessions;
    const intervalMs = room.intervalMs;

    let session = await this.sessionModel
      .findOne({ room: roomId, status: 'waiting' })
      .sort({ createdAt: -1 })
      .populate([
        {
          path: 'room',
          populate: {
            path: 'bingoBoards',
          },
        },
      ]);

    let numberOfSessions = await this.sessionModel.countDocuments({
      status: 'active',
      room: roomId,
    });

    if (session) {
      let state = this.sessions.get(session.id);
      if (!state) {
        this.sessionModel.findByIdAndDelete(session.id).then(() => {
          console.warn('Deleted stale session without state:', session?.id);
        });
        throw new WsException({
          status: 0,
          msg: 'You have a pending session. Please join it or wait until it starts.',
        });
      }

      let totalAssignedBoards = Array.from(
        state.assignedBoards.values(),
      ).reduce((sum, usr) => sum + usr.size, 0);

      if (
        totalAssignedBoards >= ((session.room as Room).bingoBoards.length || 0)
      ) {
        throw new WsException({ status: 0, msg: 'Room is full' });
      }

      state.assignedBoards.set(userId, new Set());
      this.sessions.set(session.id, state);

      return session;
    }

    if (numberOfSessions >= maxNoOfSessions)
      throw new WsException({
        status: 0,
        msg: 'You have a pending session. Please join it or wait until it starts.',
      });

    session = await this.sessionModel.create({
      room: roomId,
      intervalMs,
      users: [],
      status: 'waiting',
    });
    await session.populate([
      {
        path: 'room',
        populate: {
          path: 'bingoBoards',
        },
      },
    ]);

    this.initRoomBoards(
      roomId.toString(),
      (session.room as Room).bingoBoards.map((b) => b as BingoBoardDocument),
    );

    this.initSession(roomId, session.id, userId, (session.room as Room).hitsToWin || 1);
    this.events.emitSessionEvent(
      session.id,
      undefined,
      session.users.filter((u) => !u.forfeited).length,
    );

    return session;
  }

  async createSessionTransaction(
    amount: number,
    type: SessionTransactionType,
    userId: string,
  ) {
    try {
      const transaction = await this.transaction.create(
        amount,
        TransactionStatus.Completed,
        userId,
      );
      if (!transaction) {
        throw new BadRequestException('Could not create transaction');
      }
      const sessionTransaction = new this.sTransactionModel({
        transaction: transaction._id,
        type,
      });
      return await sessionTransaction.save();
    } catch (error) {
      console.warn('Error creating session transaction:', error);
      throw new BadRequestException('Could not create session transaction');
    }
  }

  async leave(
    sessionToken: string,
    client: Socket,
    userId?: string,
    sessionId?: string,
  ) {
    let payload: {
      sub: string;
      sessionId: string;
      roomId: string;
      minPlayers: number;
      balance: number;
      stake: number;
    };

    if (sessionToken !== '') {
      try {
        payload = await this.jwtService.verifyAsync(sessionToken);
      } catch (e) {
        console.warn(e);
        throw new WsException('Invalid session token');
      }
    } else if (userId && sessionId) {
      payload = {
        sub: userId,
        sessionId,
        roomId: '',
        minPlayers: 0,
        balance: 0,
        stake: 0,
      };
    } else {
      throw new WsException('Invalid parameters');
    }

    const state = this.sessions.get(payload.sessionId);
    if (!state) throw new WsException('Session not found');

    if (!state.assignedBoards.has(payload.sub)) {
      throw new WsException('User not in session');
    }

    if (
      state.assignedBoards.size == 1 &&
      state.state == SessionStatus.Waiting
    ) {
      this.sessions.delete(payload.sessionId);
      this.events.stop(payload.sessionId);
      this.sessionModel.findByIdAndDelete(payload.sessionId).then(() => {
        console.log('Deleted empty session');
      });
      return {
        leave: true,
      };
    }

    if (
      state.state == SessionStatus.Waiting ||
      state.state == SessionStatus.Countdown
    ) {
      state.assignedBoards.delete(payload.sub);
      await client.leave(payload.sessionId);
      this.sessionModel.findById(payload.sessionId).then(async (session) => {
        if (!session) return;
        const playerIndex = session.users.findIndex(
          (u) => u.userId.toString() == payload.sub,
        );
        if (playerIndex >= 0) {
          session.users.splice(playerIndex, 1);
          await session.save();
          const playerCount = session.users.filter((u) => !u.forfeited).length;
          this.events.emitSessionEvent(
            session.id,
            undefined,
            playerCount,
            undefined,
            undefined,
            { userId: payload.sub, boardId: undefined },
          );
        }
      });

      const players = Array.from(state.assignedBoards.values()).filter(
        (board) => board.size > 0,
      ).length;
      const minPlayers = payload.minPlayers || 2;
      if (players < minPlayers && state.state === SessionStatus.Countdown) {
        this.cancelAutoStartAndReturnToWaiting(payload.sessionId);
      }

      return {
        leave: true,
      };
    }

    return {
      canForfeit: true,
    };
  }

  async forfeit(sessionToken: string, client: Socket): Promise<Player> {
    let payload: {
      sub: string;
      sessionId: string;
      roomId: string;
      minPlayers: number;
      balance: number;
      stake: number;
    };
    try {
      payload = await this.jwtService.verifyAsync(sessionToken);
    } catch {
      throw new WsException('Invalid session token');
    }

    const state = this.sessions.get(payload.sessionId);
    if (!state) throw new WsException('Session not found');

    if (!state.assignedBoards.has(payload.sub)) {
      throw new WsException('User not in session');
    }

    state.assignedBoards.get(payload.sub)?.clear();

    const session = await this.sessionModel.findById(payload.sessionId);
    if (!session) throw new WsException('Session not found');

    const playerIndex = session.users.findIndex(
      (u) => u.userId.toString() == payload.sub,
    );
    if (playerIndex < 0) {
      throw new WsException('User not found in room');
    }
    session.users[playerIndex].forfeited = true;
    this.events.emitSessionEvent(
      session.id,
      undefined,
      session.users.filter((u) => !u.forfeited).length,
    );
    await session.save();

    await session.save();
    await client.leave(payload.sessionId);

    const players = Array.from(state.assignedBoards.values()).filter(
      (board) => board.size > 0,
    ).length;
    const minPlayers = payload.minPlayers || 2;
    if (players < minPlayers && state.state === SessionStatus.Countdown) {
      this.cancelAutoStartAndReturnToWaiting(payload.sessionId);
    }
    return session.users[playerIndex];
  }

  async start(sessionId: string) {
    const session = await this.sessionModel
      .findById(sessionId)
      .populate('room')
      .exec();
    if (!session) throw new NotFoundException('Session not found');

    const state = this.sessions.get(sessionId);
    if (!state) throw new NotFoundException('Session state not found');

    const roomStake = (session.room as Room).stake;

    const totalBoards = Array.from(state.assignedBoards.values()).reduce(
      (sum: number, boards: Set<number>): number => sum + boards.size,
      0,
    );
    const stakePool = totalBoards * roomStake;

    // const stakePool = session.users.reduce((sum, player) => sum + player.stake, 0);

    const houseProfit = Math.floor(stakePool * 0.1);

    state.prize = stakePool - houseProfit;

    session.stakePool = stakePool;
    session.houseProfit = houseProfit;
    session.status = 'active';
    session.startedAt = new Date();
    const intervalMs = (session.room as Room).intervalMs || 1500;
    await session.save();

    this.events.start(
      session.id,
      (session.room as RoomDocument)._id.toString(),
      intervalMs,
    );

    const updates = session.users.map((player) => {
      const playerBoards =
        state.assignedBoards.get(player.userId.toString()) ?? new Set();
      const playerStake = playerBoards.size * roomStake;

      this.createSessionTransaction(
        playerStake,
        SessionTransactionType.Stake,
        player.userId.toString(),
      );

      let fromReward = 0;
      let fromMain = 0;

      if (player.reward_balance >= playerStake) {
        fromReward = playerStake;
      } else {
        fromReward = player.reward_balance;
        fromMain = playerStake - player.reward_balance;
      }

      return {
        updateOne: {
          filter: { _id: player.userId },
          update: { $inc: { main_balance: -fromMain, reward_balance: -fromReward } }, // atomic decrement
        },
      };
    });

    await this.userModel
      .bulkWrite(updates)
      .then(() => console.log('Balances updated'))
      .catch((err) => console.error('Failed to update balances', err));

    return session.toObject();
  }

  async stop(sessionId: string) {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');

    session.status = 'finished';
    session.endedAt = new Date();
    await session.save();

    this.events.stop(sessionId);
    return session.toObject();
  }

  async assignBoard(sessionToken: string, boardId: string) {
    let payload: {
      sub: string;
      sessionId: string;
      roomId: string;
      minPlayers: number;
      balance: number;
      stake: number;
    };
    try {
      payload = await this.jwtService.verifyAsync(sessionToken);
    } catch {
      throw new WsException('Invalid session token');
    }

    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      throw new WsException('Session not found');
    }

    if (session.state === SessionStatus.Active) {
      throw new WsException('Cannot change boards after session has started');
    }

    const userObjId = new Types.ObjectId(payload.sub);
    const sessionObjId = new Types.ObjectId(payload.sessionId);

    const chosenBoard = this.boardIds
      .get(payload.roomId)
      ?.boards.find((b) => b.boardId.equals(new Types.ObjectId(boardId)));

    if (!chosenBoard) {
      throw new WsException('Board not found');
    }
    const boardObjId = new Types.ObjectId(chosenBoard.boardId);

    const userBoards =
      session.assignedBoards.get(payload.sub) ?? new Set<number>();
    const boardCost = payload.stake; // Set your per-board cost
    const totalCost = userBoards.size * boardCost;

    const existingAssignment = userBoards.has(chosenBoard.boardNumber);
    if (existingAssignment) {
      userBoards.delete(chosenBoard.boardNumber);

      session.assignedBoards.set(payload.sub, userBoards);

      this.aBoardModel
        .deleteOne({
          userId: userObjId,
          gameSessionId: sessionObjId,
          boardId: chosenBoard.boardId,
        })
        .then(() => console.log('Deleted board From database assignment'));
      this.events.emitSessionEvent(
        payload.sessionId,
        undefined,
        undefined,
        undefined,
        undefined,
        { userId: payload.sub, boardId: chosenBoard.boardNumber },
      );
      const players = Array.from(session.assignedBoards.values()).filter(
        (board) => board.size > 0,
      ).length;
      const minPlayers = payload.minPlayers || 2;
      if (players < minPlayers && session.state === SessionStatus.Countdown) {
        this.cancelAutoStartAndReturnToWaiting(payload.sessionId);
      }
      // this.gateway.sendChosenBoard(sessionToken, {
      //   removed: true,
      //   boardId: chosenBoard.boardId,
      // });
      return { removed: true, boardId: chosenBoard.boardId };
    }

    if (payload.balance < totalCost + boardCost) {
      throw new BadRequestException(
        'Insufficient balance to select another board',
      );
    }

    const count = userBoards.size;
    if (count >= 3) {
      throw new BadRequestException(
        'User already has maximum number of boards for this session',
      );
    }

    const isAssigned = Array.from(session.assignedBoards.values()).some(
      (boardSet) => boardSet.has(chosenBoard.boardNumber),
    );

    if (isAssigned) {
      throw new BadRequestException('Board already assigned in this session');
    }

    userBoards.add(chosenBoard.boardNumber);
    session.assignedBoards.set(payload.sub, userBoards);

    this.aBoardModel
      .create({
        userId: userObjId,
        gameSessionId: sessionObjId,
        boardId: boardObjId,
      })
      .then(() => console.log('Created board From database assignment'));

    this.events.emitSessionEvent(
      payload.sessionId,
      undefined,
      undefined,
      undefined,
      { userId: payload.sub, boardId: chosenBoard.boardNumber },
    );

    const players = Array.from(session.assignedBoards.values()).filter(
      (board) => board.size > 0,
    ).length;
    const minPlayers = payload.minPlayers || 2;
    if (players >= minPlayers) {
      const room = await this.roomModel.findById(payload.roomId);
      const waitingTime = room?.waitingTime ?? 60000;
      const shouldAutoStart = !!room?.autoStart;
      if (shouldAutoStart) {
        this.scheduleAutoStart(payload.sessionId, waitingTime);
      }
    }
    // this.gateway.sendChosenBoard(sessionToken, {
    //   added: true,
    //   boardId: chosenBoard.boardId,
    // });
    return { added: true, boardId: chosenBoard.boardId };
  }

  public async startPrivateSession(sessionId: string, userId: string): Promise<boolean> {
    const room = await this.roomModel.findOne({ createdBy: new Types.ObjectId(userId) })
    if (!room) throw new NotFoundException('Room not found for user');

    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.roomId !== room._id.toString()) throw new BadRequestException('Session does not belong to user room');

    this.scheduleAutoStart(sessionId, 10000);
    return true;
  }

  public async stopPrivateSession(sessionId: string, userId: string): Promise<boolean> {
    const room = await this.roomModel.findOne({ createdBy: new Types.ObjectId(userId) })
    if (!room) throw new NotFoundException('Room not found for user');

    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.roomId !== room._id.toString()) throw new BadRequestException('Session does not belong to user room');

    return this.cancelAutoStartAndReturnToWaiting(sessionId);
  }

  private scheduleAutoStart(sessionId: string, waitMs: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.state !== SessionStatus.Waiting) return;

    const existing = this.countdownTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      this.countdownTimers.delete(sessionId);
    }

    this.events.emitSessionEvent(
      sessionId,
      SessionStatus.Countdown,
      undefined,
      new Date(Date.now() + waitMs).toISOString(),
      undefined,
      undefined,
      undefined,
      session.roomId
    );
    const timer = setTimeout(async () => {
      this.countdownTimers.delete(sessionId);
      session.state = SessionStatus.Active;
      this.sessions.set(sessionId, session);
      try {
        await this.start(sessionId);
        this.events.emitSessionEvent(sessionId, SessionStatus.Active);
      } catch (e) {
        console.error('Error during auto-start:', e);
      }
    }, waitMs);
    this.countdownTimers.set(sessionId, timer);
    session.state = SessionStatus.Countdown;
    this.sessions.set(sessionId, session);
  }

  private cancelAutoStartAndReturnToWaiting(sessionId: string): boolean {
    const state = this.sessions.get(sessionId);
    if (!state) return false;
    if (state.state !== SessionStatus.Countdown) {
      return false;
    }

    const timer = this.countdownTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.countdownTimers.delete(sessionId);
    }
    state.state = SessionStatus.Waiting;
    this.sessions.set(sessionId, state);
    this.events.emitSessionEvent(
      sessionId,
      SessionStatus.Waiting,
      undefined,
      null,
    );
    return true;
  }

  async listByRoom(roomId: string) {
    return this.sessionModel.find({ roomId }).sort({ createdAt: -1 }).lean();
  }

  async handleClientDisconnect(
    sessionId: string,
    userId: string,
    client: Socket,
  ) {
    this.leave('', client, userId, sessionId).catch((e) => {
      console.warn('handleClientDisconnect error:', e?.message || e);
    });
  }

  async handleBingoClaim(sessionToken: string, boardNumber: number) {
    let payload: {
      sub: string;
      sessionId: string;
      roomId: string;
      minPlayers: number;
      balance: number;
      stake: number;
    };

    try {
      payload = await this.jwtService.verifyAsync(sessionToken);
    } catch {
      throw new BadRequestException('Invalid session token');
    }

    const sessionId = payload.sessionId;
    const userId = payload.sub;

    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException('Session not found');

    const userBoards = session.assignedBoards.get(userId);
    if (!userBoards) throw new BadRequestException('User not in session');

    const invalidBoards = userBoards.has(boardNumber);
    if (!invalidBoards) throw new BadRequestException('Invalid board numbers');

    const calledNumbers: number[] =
      this.events.getSessionState(sessionId)?.calledNumbers || [];
    if (!calledNumbers || calledNumbers.length === 0) {
      throw new BadRequestException('No numbers have been called yet');
    }

    const board = this.boardIds
      .get(payload.roomId)
      ?.boards.find((b) => b.boardNumber === boardNumber);
    if (!board) throw new NotFoundException('Board not found');
    const hits = this.checkCartela(
      calledNumbers,
      payload.roomId,
      board.numbers,
    );
    if (hits == 0) {
      throw new BadRequestException('No numbers have been called yet');
    }

    if (hits >= (session?.hitsToWin || 1)) {
      this.events.emitSessionEvent(
        sessionId,
        SessionStatus.Completed,
        undefined,
        undefined,
        undefined,
        undefined,
        { boardNumber: board.boardNumber },
      );

      const result = {
        boardId: board.boardId,
        boardNumber: board.boardNumber,
        hits,
        prize: session.prize || 0,
      };

      setImmediate(async () => {
        try {
          const user = await this.userModel.findById(userId);
          if (!user) {
            console.error('User not found:', userId);
            return;
          }

          const sessionD = await this.sessionModel.findById(sessionId);
          if (!sessionD) {
            console.error('Session not found in database:', sessionId);
            return;
          }

          const prize = sessionD.stakePool - sessionD.houseProfit;
          user.main_balance += prize;
          await user.save();

          await this.createSessionTransaction(
            prize,
            SessionTransactionType.Win,
            userId,
          );

          sessionD.status = 'finished';
          sessionD.endedAt = new Date();
          await sessionD.save();

          this.sessions.delete(sessionId);
          this.events.stop(sessionId);

          // Disconnect all WebSocket clients from the room
          if (this.gateway) {
            await this.gateway.disconnectRoomClients(payload.roomId);
          }

          console.log(
            'Background processing completed for session:',
            sessionId,
          );
        } catch (error) {
          console.error('Error in background processing:', error);
        }
      });

      return result;
    }
  }

  checkCartela(
    calledNumbers: number[],
    _roomId: string,
    numbers: number[],
  ): number {
    let hits = 0;

    hits += this.checkRows(calledNumbers, numbers);
    hits += this.checkColumns(calledNumbers, numbers);
    hits += this.checkDiagonals(calledNumbers, numbers);
    hits += this.checkFDiagonals(calledNumbers, numbers);
    hits += this.checkCorner(calledNumbers, numbers);
    return hits;
  }

  checkColumns(numbers: number[], cartelaNum: number[]) {
    const size = 5; // 5x5 board
    let hit = 0;
    const called = new Set(numbers);

    for (let row = 0; row < size; row++) {
      let matched = 0;
      let needed = size;

      for (let col = 0; col < size; col++) {
        if (row === 2 && col === 2) {
          needed--;
          continue;
        }

        const index = row * size + col;

        if (called.has(cartelaNum[index])) {
          matched++;
        }
      }

      if (matched === needed) {
        hit++;
      }
    }

    return hit;
  }

  checkRows(numbers: number[], cartelaNum: number[]) {
    const size = 5; // 5x5 board
    const called = new Set(numbers);
    let hit = 0;

    for (let col = 0; col < size; col++) {
      let matched = 0;
      let needed = size;

      for (let row = 0; row < size; row++) {
        if (row === 2 && col === 2) {
          needed--; // this column only needs 4 matches
          continue;
        }

        const index = row * size + col;

        if (called.has(cartelaNum[index])) {
          matched++;
        }
      }

      if (matched === needed) {
        hit++;
      }
    }

    return hit;
  }

  checkDiagonals(numbers: number[], cartelaNum: number[]) {
    const called = new Set(numbers);
    let hit = 0;

    for (let idx = 0; idx < 25; idx += 6) {
      if (idx == 12) continue;
      if (called.has(cartelaNum[idx])) {
        hit++;
      }
    }
    if (hit == 4) return 1;
    return 0;
  }

  checkFDiagonals(numbers: number[], cartelaNum: number[]) {
    const called = new Set(numbers);
    let hit = 0;

    for (let idx = 4; idx < 21; idx += 4) {
      if (idx == 12) continue;
      if (called.has(cartelaNum[idx])) {
        hit++;
      }
    }
    if (hit == 4) return 1;
    return 0;
  }

  checkCorner(numbers: number[], cartelaNum: number[]) {
    if (
      numbers.includes(cartelaNum[0]) &&
      numbers.includes(cartelaNum[4]) &&
      numbers.includes(cartelaNum[20]) &&
      numbers.includes(cartelaNum[24])
    ) {
      return 1;
    }
    return 0;
  }
}
