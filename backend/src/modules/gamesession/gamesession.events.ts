import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReplaySubject, Observable, Subject } from 'rxjs';
import {
  GameSession,
  GameSessionDocument,
} from 'src/database/schema/gamesession.schema';
import { Socket } from 'socket.io';

export interface CalledNumberEvent {
  sessionId: string;
  roomId: string;
  number: number;
  count: number;
  timestamp: string;
}

export enum SessionStatus {
  Waiting = 'waiting',
  Active = 'active',
  Countdown = 'countdown',
  Completed = 'completed',
}

interface WinnerInfo {
  boardNumber: number;
}

export interface SessionInfoEvent {
  sessionId: string;
  count: number;
  assignedBoards: Record<string, number[]>;
  status: SessionStatus;
  startTime?: string;
  winner?: WinnerInfo;
  timestamp: string;
}

interface SessionState {
  timer: NodeJS.Timeout;
  queue: number[];
  calledCount: number;
  calledNumbers: number[];
}

@Injectable()
export class GameSessionEventsService {
  private readonly sessionStreams = new Map<
    string,
    ReplaySubject<CalledNumberEvent>
  >();
  private readonly sessionStates = new Map<string, SessionState>();

  private readonly sessionFinished$ = new Subject<{
    sessionId: string;
    roomId: string;
  }>();

  private readonly sessionInfoStreams = new Map<
    string,
    ReplaySubject<SessionInfoEvent>
  >();
  private readonly latestSessionInfo = new Map<string, SessionInfoEvent>();
  public latestRoomCountdowns = new Map<string, { status: SessionStatus, date: Date }>();

  // Map of sessionId -> Set of client Socket IDs
  private readonly sessionClients = new Map<string, Set<string>>();
  // Map of client Socket ID -> Socket instance
  private readonly clientSockets = new Map<string, Socket>();
  // Map client -> session
  private readonly clientToSession = new Map<string, string>();
  // Map client -> userId
  private readonly clientToUser = new Map<string, string>();

  private gateway: any;

  constructor(
    @InjectModel(GameSession.name)
    private readonly sessionModel: Model<GameSessionDocument>,
  ) { }

  setGateway(gateway: any) {
    this.gateway = gateway;
  }

  getSessionState(sessionId: string) {
    return this.sessionStates.get(sessionId);
  }

  // Register a client for WebSocket streaming
  registerClient(sessionId: string, userId: string, client: Socket) {
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    this.sessionClients.get(sessionId)!.add(client.id);
    this.clientSockets.set(client.id, client);
    this.clientToSession.set(client.id, sessionId);
    this.clientToUser.set(client.id, userId);
    console.log(`Client ${client.id} registered for session ${sessionId}`);

    // Immediately send the latest session info snapshot to the newly registered client
    const latest = this.latestSessionInfo.get(sessionId);
    if (latest) {
      try {
        client.emit('sessionInfo', latest);
      } catch (err) {
        console.warn(
          'Failed to emit initial sessionInfo to client',
          client.id,
          err,
        );
      }
    }
  }

  // Unregister a client from WebSocket streaming
  unregisterClient(clientId: string) {
    // Remove client from all sessions
    this.sessionClients.forEach((clients, sessionId) => {
      if (clients.has(clientId)) {
        clients.delete(clientId);
        console.log(
          `Client ${clientId} unregistered from session ${sessionId}`,
        );
      }
    });
    this.clientSockets.delete(clientId);
    this.clientToSession.delete(clientId);
    this.clientToUser.delete(clientId);
  }

  getClientBinding(clientId: string): {
    sessionId: string | undefined;
    userId: string | undefined;
  } {
    return {
      sessionId: this.clientToSession.get(clientId),
      userId: this.clientToUser.get(clientId),
    };
  }

  // Emit events to all registered WebSocket clients for a session
  private emitToSessionClients(sessionId: string, event: string, data: any) {
    const clients = this.sessionClients.get(sessionId);
    if (!clients) return;

    clients.forEach((clientId) => {
      const socket = this.clientSockets.get(clientId);
      if (socket) {
        socket.emit(event, data);
      }
    });
  }

  getSessionStream(sessionId: string): Observable<CalledNumberEvent> {
    return this.getOrCreateSubject(sessionId).asObservable();
  }

  onSessionFinished(): Observable<{ sessionId: string; roomId: string }> {
    return this.sessionFinished$.asObservable();
  }

  async checkSession(sessionId: string) {
    const session = await this.sessionModel.findById(sessionId);

    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.status === 'finished') {
      throw new BadRequestException('Session already finished');
    }
  }

  getSessionInfoStream(sessionId: string) {
    if (!this.sessionInfoStreams.has(sessionId)) {
      this.sessionInfoStreams.set(
        sessionId,
        new ReplaySubject<SessionInfoEvent>(),
      );
    }
    return this.sessionInfoStreams.get(sessionId)!;
  }

  emitSessionEvent(
    sessionId: string,
    status?: SessionStatus,
    count?: number,
    startTime?: string | null,
    assignedBoard?: { userId: string; boardId: number },
    removeBoard?: { userId: string; boardId?: number },
    winner?: WinnerInfo,
    roomId?: string,
  ) {
    const last = this.latestSessionInfo.get(sessionId);

    let assignedBoards: Record<string, number[]> = {
      ...(last?.assignedBoards ?? {}),
    };

    if (assignedBoard) {
      const userBoards = assignedBoards[assignedBoard.userId] ?? [];

      if (!userBoards.includes(assignedBoard.boardId)) {
        if (userBoards.length < 3) {
          userBoards.push(assignedBoard.boardId);
        } else {
          // Optional: handle case when user already has 3 boards
          console.warn(`User ${assignedBoard.userId} already has 3 boards`);
        }
      }

      assignedBoards[assignedBoard.userId] = userBoards;
    }

    if (removeBoard) {
      if (removeBoard.boardId !== undefined) {
        assignedBoards[removeBoard.userId] = (
          assignedBoards[removeBoard.userId] ?? []
        ).filter((id) => id !== removeBoard.boardId);
      } else {
        delete assignedBoards[removeBoard.userId];
      }
    }

    // Determine next startTime. If startTime is explicitly null, clear it.
    const nextStartTime =
      startTime === null ? undefined : (startTime ?? last?.startTime);

    const event: SessionInfoEvent = {
      sessionId,
      count: count ?? last?.count ?? 0,
      assignedBoards,
      status: status ?? last?.status ?? SessionStatus.Waiting,
      winner: winner ?? last?.winner,
      startTime: nextStartTime,
      timestamp: new Date().toISOString(),
    };

    this.latestSessionInfo.set(sessionId, event);
    if (roomId) {
      this.latestRoomCountdowns.set(roomId, { status: status ?? last?.status ?? SessionStatus.Waiting, date: new Date(nextStartTime ?? "") })
    }

    // Emit to SSE subscribers
    this.getSessionInfoStream(sessionId).next(event);

    // Emit to WebSocket clients
    this.emitToSessionClients(sessionId, 'sessionInfo', event);

    this.gateway.broadcastPublicRoomsUpdate().catch((err: any) => {
      console.warn('Failed to broadcast public rooms update:', err);
    });
  }

  start(sessionId: string, roomId: string, intervalMs = 1000) {
    if (this.sessionStates.has(sessionId)) return { started: false };

    const queue = this.shuffleNumbers();
    const state: SessionState = {
      timer: setInterval(() => this.tick(sessionId, roomId), intervalMs),
      queue,
      calledCount: 0,
      calledNumbers: [],
    };
    this.sessionStates.set(sessionId, state);

    return { started: true };
  }

  stop(sessionId: string) {
    const state = this.sessionStates.get(sessionId);
    if (!state) return { stopped: false };
    clearInterval(state.timer);
    this.sessionStates.delete(sessionId);

    const subject = this.sessionStreams.get(sessionId);
    if (subject) {
      subject.complete();
      this.emitSessionEvent(sessionId, SessionStatus.Completed);
      this.sessionStreams.delete(sessionId);
    }

    const iSubject = this.sessionInfoStreams.get(sessionId);
    if (iSubject) {
      iSubject.complete();
      this.latestSessionInfo.delete(sessionId);
    }

    // Notify WebSocket clients that streams are complete
    this.emitToSessionClients(sessionId, 'streamComplete', { sessionId });
    this.emitToSessionClients(sessionId, 'infoComplete', { sessionId });

    // Clean up client registrations for this session
    this.sessionClients.delete(sessionId);

    return { stopped: true };
  }

  private tick(sessionId: string, roomId: string) {
    const state = this.sessionStates.get(sessionId);
    if (!state) return;

    const next = state.queue.shift();
    if (typeof next !== 'number') {
      this.stopSession(sessionId, roomId);
      return;
    }

    state.calledCount++;
    state.calledNumbers.push(next);
    const event: CalledNumberEvent = {
      sessionId,
      roomId,
      number: next,
      count: state.calledCount,
      timestamp: new Date().toISOString(),
    };

    // Emit to SSE subscribers
    this.getOrCreateSubject(sessionId).next(event);

    // Emit to WebSocket clients
    this.emitToSessionClients(sessionId, 'calledNumber', event);
  }

  private getOrCreateSubject(sessionId: string) {
    let subject = this.sessionStreams.get(sessionId);
    if (!subject) {
      subject = new ReplaySubject<CalledNumberEvent>(75);
      this.sessionStreams.set(sessionId, subject);
    }
    return subject;
  }

  private async stopSession(sessionId: string, roomId: string) {
    const state = this.sessionStates.get(sessionId);
    if (!state) return;

    // Stop the interval and SSE
    this.stop(sessionId);

    // Persist all called numbers at once
    const session = await this.sessionModel.findById(sessionId);
    if (session) {
      session.calledNumbers = state.calledNumbers || [];
      session.calledCount = state.calledCount;
      session.status = 'finished';
      session.endedAt = new Date();
      await session.save();
    }

    this.sessionFinished$.next({ sessionId, roomId });
  }

  private shuffleNumbers() {
    const arr = Array.from({ length: 75 }, (_, i) => i + 1);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
