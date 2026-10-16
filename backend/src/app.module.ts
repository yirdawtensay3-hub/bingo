import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { User, UserSchema } from './database/schema/user.schema';
import { TelegramModule } from './modules/telegram/telegram.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppGateway } from './app.gateway';
import { RoomModule } from './modules/room/room.module';
import { GameSessionModule } from './modules/gamesession/gamesession.module';
import { TransactionModule } from './modules/transaction/transaction.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri:
          process.env.MONGODB_URI ||
          'mongodb://localhost:27019/bingo?directConnection=true',
        connectionFactory: (connection) => {
          connection.on('connected', () => {
            Logger.log('✅ MongoDB connected', 'Mongoose');
          });
          connection.on('error', (err: any) => {
            Logger.error(`❌ MongoDB connection error: ${err}`, 'Mongoose');
          });
          connection.on('disconnected', () => {
            Logger.warn('⚠️ MongoDB disconnected', 'Mongoose');
          });
          return connection;
        },
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'super-secret',
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UserModule,
    AuthModule,
    TelegramModule,
    RoomModule,
    GameSessionModule,
    TransactionModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppGateway],
  exports: [AppGateway],
})
export class AppModule {}
