import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Sse,
  UseGuards,
  Req,
} from '@nestjs/common';
import { GameSessionService } from './gamesession.service';
import {
  GameSessionEventsService,
  CalledNumberEvent,
  SessionInfoEvent,
} from './gamesession.events';
import { Observable, map } from 'rxjs';
import { AssignBoardDto } from './dto/assingBoard.dto';
import { CheckBingo, LeaveSession } from './dto/gamesession.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from 'src/database/schema/user.schema';

@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class GameSessionController {
  constructor(
    private service: GameSessionService,
    private events: GameSessionEventsService,
  ) { }

  @Get('room/:roomId')
  async listByRoom(@Param('roomId') roomId: string) {
    return this.service.listByRoom(roomId);
  }

  @Post('room/:sessionId/start')
  async start(@Param('sessionId') roomId: string, @Req() req: any) {
    const user: UserDocument = req.user;
    const res = await this.service.startPrivateSession(roomId, user._id.toString());
    return { success: res, message: 'Game session will start in 10 seconds' };
  }

  @Post(':sessionId/stop')
  async stop(@Param('sessionId') sessionId: string, @Req() req: any) {
    const user: UserDocument = req.user;
    const success = await this.service.stopPrivateSession(sessionId, user._id.toString());
    if (success) {
      return { success: true, message: 'Game session has been stopped' };
    }
    return { success: false, message: 'No scheduled start found for this session' };
  }

  @Post('board/choose')
  async assign(@Body() body: AssignBoardDto) {
    return new Promise((resolve, reject) => {
      this.service.enqueue(body.sessionToken, async () => {
        try {
          resolve(
            await this.service.assignBoard(body.sessionToken, body.boardId),
          );
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  @Post('/bingo')
  async bingoClaim(@Body() body: CheckBingo) {
    return this.service.handleBingoClaim(body.sessionToken, body.boardNumber);
  }

  @Sse(':sessionId/stream')
  async stream(
    @Param('sessionId') sessionId: string,
  ): Promise<Observable<MessageEvent>> {
    await this.events.checkSession(sessionId);
    return this.events
      .getSessionStream(sessionId)
      .pipe(
        map((event: CalledNumberEvent) => ({ data: event }) as MessageEvent),
      );
  }

  @Sse(':sessionId/info')
  async sessionInfo(
    @Param('sessionId') sessionId: string,
  ): Promise<Observable<MessageEvent>> {
    await this.events.checkSession(sessionId);
    return this.events
      .getSessionInfoStream(sessionId)
      .pipe(
        map((event: SessionInfoEvent) => ({ data: event }) as MessageEvent),
      );
  }
}
