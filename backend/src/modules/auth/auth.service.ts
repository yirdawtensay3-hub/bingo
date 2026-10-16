import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { UserDocument } from '../../database/schema/user.schema';
import crypto from 'crypto';
import { validate, parse, type InitData } from '@telegram-apps/init-data-node';

export interface JwtPayload {
  sub: string;
  username?: string;
  firstName?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) { }

  async authenticateFromTelegram(
    initData: string,
    botToken: string,
    invitedBy: string,
  ): Promise<UserDocument> {
    try {
      // Validate init data.
      validate(initData, botToken, {
        // We consider init data sign valid for 1 hour from their creation moment.
        expiresIn: 3600,
      });

      const parsedInitData = parse(initData) as InitData;
      const userData = parsedInitData.user;
      if (!userData) {
        throw new UnauthorizedException('Missing user data from Telegram');
      }

      const user = await this.userService.findOrCreate({
        telegramId: userData.id.toString(),
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        invitedBy: invitedBy
      });

      return user;
      // Parse init data. We will surely need it in the future.
    } catch (e) {
      console.warn('Telegram auth error:', e);
      throw new UnauthorizedException('Invalid Telegram data');
    }
  }

  async login(user: UserDocument) {
    // Require phone number
    if (!user.phoneNumber) {
      throw new ForbiddenException('PHONE_REQUIRED');
    }
    const payload: JwtPayload = {
      sub: user.telegramId,
      username: user.username,
      firstName: user.firstName,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        userId: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        balance: (user.main_balance + user.reward_balance),
        phoneNumber: user.phoneNumber,
      },
    };
  }

  async validateToken(payload: JwtPayload): Promise<UserDocument | null> {
    return this.userService.findByTelegramId(payload.sub);
  }
}
