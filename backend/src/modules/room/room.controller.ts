import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomRequestDto, UpdateRoomStatusDto, UpdateRoomDto } from './dto/room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Req } from '@nestjs/common';
import { UserDocument } from 'src/database/schema/user.schema';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) { }

  @Get()
  async list() {
    return this.roomService.listRooms();
  }

  @Get("myroom")
  async getMyRoom(@Req() req: any) {
    const user: UserDocument = req.user;
    return this.roomService.getMyRoom(user.id);
  }

  @Get(':roomId')
  async get(@Param('roomId') roomId: string) {
    return this.roomService.getRoomById(roomId);
  }

  @Get('code/:code')
  async getByCode(@Param('code') code: string) {
    return this.roomService.getRoomByCode(code);
  }

  @Post()
  async create(
    @Body(ValidationPipe) body: CreateRoomRequestDto,
    @Req() req: any,
  ) {
    const user: UserDocument = req.user;
    // Admins can create any type with autoStart; non-admins force private, no autostart
    const isAdmin = user.isAdmin ? user.isAdmin : false;
    const payload = {
      name: body.name,
      description: body.description,
      createdBy: user._id,
      houseCutPercent: isAdmin ? body.houseCutPercent : 10,
      maxPlayers: body.maxPlayers,
      minPlayers: body.minPlayers,
      stake: body.stake,
      hitsToWin: body.hitsToWin,
      waitingTime: body.waitingTime,
      type: isAdmin ? (body.type ?? "public") : "private",
      autoStart: body.autoStart,
      maxNoOfSessions: isAdmin ? (body.maxNoOfSessions) : 1,
    };
    return this.roomService.createRoom(payload as any, isAdmin);
  }

  @Put(':roomId')
  async update(
    @Param('roomId') roomId: string,
    @Body(ValidationPipe) body: UpdateRoomDto,
    @Req() req: any,
  ) {
    const user: UserDocument = req.user;
    return this.roomService.updateRoom(
      roomId,
      user.id,
      user.isAdmin ?? false,
      body,
    );
  }

  @Delete(':roomId')
  async delete(@Param('roomId') roomId: string, @Req() req: any) {
    const user: UserDocument = req.user;
    return this.roomService.deleteRoom(roomId, user.id, user.isAdmin ?? false);
  }

  @Post(':roomId/status')
  async updateStatus(
    @Param('roomId') roomId: string,
    @Body(ValidationPipe) body: UpdateRoomStatusDto,
  ) {
    return this.roomService.updateStatus(roomId, body.status);
  }

  // Start room by creator
  @Post(':roomId/start')
  async start(@Param('roomId') roomId: string, @Req() req: any) {
    const user: UserDocument = req.user;
    return this.roomService.startRoom(roomId, user.id);
  }
}
