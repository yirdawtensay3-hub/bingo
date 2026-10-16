import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from '../../database/schema/room.schema';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { GameSessionModule } from '../gamesession/gamesession.module';
import {
  GameSession,
  GameSessionSchema,
} from 'src/database/schema/gamesession.schema';
import {
  BingoBoard,
  BingoBoardSchema,
} from 'src/database/schema/bingoboard.schema';
import { User, UserSchema } from 'src/database/schema/user.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: BingoBoard.name, schema: BingoBoardSchema },
      { name: User.name, schema: UserSchema },
      { name: GameSession.name, schema: GameSessionSchema },
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
    GameSessionModule,
  ],
  providers: [RoomService],
  controllers: [RoomController],
  exports: [RoomService],
})
export class RoomModule {}
