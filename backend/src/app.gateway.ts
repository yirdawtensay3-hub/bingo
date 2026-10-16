import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  WsResponse,
  OnGatewayDisconnect,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from './modules/room/room.service';
import { GameSessionService } from './modules/gamesession/gamesession.service';
import { GameSessionEventsService, SessionStatus } from './modules/gamesession/gamesession.events';
import { JwtService } from '@nestjs/jwt';
import { forwardRef, Inject, OnModuleInit } from '@nestjs/common';
import { Types } from 'mongoose';
import { async } from 'rxjs';
import client from 'telegraf/typings/core/network/client';

@WebSocketGateway({
  cors: {
    origin: [
      process.env.ORIGIN || 'https://goatbingo.pro.et', // frontend domain
    ],
    credentials: true,
  },
})
export class AppGateway implements OnModuleInit, OnGatewayDisconnect, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly roomService: RoomService,
    @Inject(forwardRef(() => GameSessionService)) // Add forwardRef
    private readonly gameService: GameSessionService,
    private readonly gameEventsService: GameSessionEventsService,
    private readonly jwtService: JwtService,
  ) { }

  onModuleInit() {
    // Set the gateway reference in the events service
    this.gameEventsService.setGateway(this);
  }

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);

    // Automatically join public rooms updates
    client.join('public-rooms-updates');

    // Send initial data
    const publicRoomsData = await this.gameService.getPublicRoomsWithLatestSessions();
    client.emit('publicRoomsData', publicRoomsData);
  }

  // Method to broadcast public rooms updates
  async broadcastPublicRoomsUpdate() {
    const publicRoomsData = await this.gameService.getPublicRoomsWithLatestSessions();
    this.server.to('public-rooms-updates').emit('publicRoomsUpdate', publicRoomsData);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() payload: { roomID: string; userID: string },
    @ConnectedSocket() client: Socket,
  ): Promise<WsResponse<any>> {
    const result = await this.roomService.joinRoom(
      payload.roomID,
      payload.userID,
      client,
    );

    const sessionId = (result.session._id as Types.ObjectId).toString();
    this.gameEventsService.registerClient(sessionId, payload.userID, client);

    return { event: 'joinedRoom', data: result };
  }

  @SubscribeMessage('joinPrivateRoom')
  async handleJoinPrivateRoom(
    @MessageBody() payload: { roomCode: string; userID: string },
    @ConnectedSocket() client: Socket,
  ): Promise<WsResponse<any>> {
    const result = await this.roomService.joinPrivate(
      payload.roomCode,
      payload.userID,
      client,
    );

    const sessionId = (result.session._id as Types.ObjectId).toString();
    this.gameEventsService.registerClient(sessionId, payload.userID, client);

    return { event: 'joinedRoom', data: result };
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() sessionToken: string,
    @ConnectedSocket() client: Socket,
  ): Promise<WsResponse<any>> {
    const result = await this.gameService.leave(sessionToken, client);
    this.gameEventsService.unregisterClient(client.id);
    const publicRoomsData = await this.gameService.getPublicRoomsWithLatestSessions();
    this.server.to('public-rooms-updates').emit('publicRoomsUpdate', publicRoomsData);
    return { event: 'leftRoom', data: result };
  }

  @SubscribeMessage('forfeit')
  async handleForfeit(
    @MessageBody() sessionToken: string,
    @ConnectedSocket() client: Socket,
  ) {
    const payload = await this.jwtService.verifyAsync(sessionToken);
    const result = await this.gameService.forfeit(sessionToken, client);
    client.leave(payload.sessionId);
    this.gameEventsService.unregisterClient(client.id);
    return { event: 'forfeited', data: result };
  }

  @SubscribeMessage('chooseBoard')
  async handleChooseBoard(
    @MessageBody() payload: { sessionToken: string; boardId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const decoded = await this.jwtService.verifyAsync(payload.sessionToken);
    this.gameService.enqueue(payload.sessionToken, async () => {
      try {
        const data = await this.gameService.assignBoard(
          payload.sessionToken,
          payload.boardId,
        );
        this.server.to(decoded.sessionId).emit('boardChosen', data);
      } catch (error) {
        console.warn('Error in chooseBoard:', error);
      }
    });
  }

  async sendChosenBoard(sessionId: string, result: any) {
    this.server.to(sessionId).emit('boardChosen', result);
  }

  async disconnectRoomClients(sessionId: string) {
    // Get all sockets in the room
    const sockets = await this.server.in(sessionId).fetchSockets();

    // Disconnect each socket from the room
    for (const socket of sockets) {
      socket.leave(sessionId);
    }

    console.log(
      `Disconnected ${sockets.length} clients from room ${sessionId}`,
    );
  }

  @SubscribeMessage('bingo')
  async handleBingo(
    @MessageBody() payload: { sessionToken: string; boardNumber: number },
    @ConnectedSocket() client: Socket,
  ) {
    const decoded = await this.jwtService.verifyAsync(payload.sessionToken);
    this.server
      .to(decoded.sessionId)
      .emit(
        'bingoResult',
        await this.gameService.handleBingoClaim(
          payload.sessionToken,
          payload.boardNumber,
        ),
      );
  }

  // Handle client disconnect to cleanup
  handleDisconnect(client: Socket) {
    // look up binding
    const binding = this.gameEventsService.getClientBinding(client.id);
    this.gameEventsService.unregisterClient(client.id);
    client.leave('public-rooms-updates');
    if (!binding.sessionId || !binding.userId) return;

    // On disconnect, attempt to remove the user if still in waiting or countdown
    this.gameService
      .handleClientDisconnect(binding.sessionId, binding.userId, client)
      .catch((e) => {
        console.warn('handleClientDisconnect error:', e?.message || e);
      });
  }
}
