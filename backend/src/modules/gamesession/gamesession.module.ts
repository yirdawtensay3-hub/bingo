import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  GameSession,
  GameSessionSchema,
} from '../../database/schema/gamesession.schema';
import { GameSessionService } from './gamesession.service';
import { GameSessionController } from './gamesession.controller';
import { GameSessionEventsService } from './gamesession.events';
import { Room, RoomSchema } from 'src/database/schema/room.schema';
import {
  AssignedBoard,
  AssignedCardSchema,
} from 'src/database/schema/assinedBoards.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { User, UserSchema } from 'src/database/schema/user.schema';
import { RoomService } from '../room/room.service';
import { TransactionModule } from '../transaction/transaction.module';
import {
  Transaction,
  TransactionSchema,
} from 'src/database/schema/transaction.schema';
import {
  SessionTransaction,
  SessionTransactionSchema,
} from 'src/database/schema/sTransaction.schema';
import {
  BingoBoard,
  BingoBoardSchema,
} from 'src/database/schema/bingoboard.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GameSession.name, schema: GameSessionSchema },
      { name: AssignedBoard.name, schema: AssignedCardSchema },
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: SessionTransaction.name, schema: SessionTransactionSchema },
      { name: BingoBoard.name, schema: BingoBoardSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'super-secret',
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
    TransactionModule,
    forwardRef(() => {
      const { AppModule } = require('../../app.module');
      return AppModule;
    }),
  ],
  providers: [GameSessionService, GameSessionEventsService, RoomService],
  controllers: [GameSessionController],
  exports: [GameSessionService, GameSessionEventsService],
})
export class GameSessionModule {}
