import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TelegramService } from 'src/modules/telegram/telegram.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly telegram: TelegramService,
  ) { }

  @Post('telegram')
  async authenticateFromTelegram(@Headers() headers: Record<string, string>, @Body() data: any) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Make sure you set this in .env
    if (!BOT_TOKEN) {
      throw new Error('Telegram bot token is not configured');
    }

    const authHeader = headers['authorization'];

    const [authType, authData = ''] = (authHeader || '').split(' ');
    if (authType === 'tma' && authData) {
      const user = await this.authService.authenticateFromTelegram(
        authData,
        BOT_TOKEN,
        data.invitedBy,
      );

      try {
        return await this.authService.login(user);
      } catch (e: any) {
        // If phone required, trigger Telegram contact request
        if (
          e?.message === 'PHONE_REQUIRED' ||
          e?.response?.message === 'PHONE_REQUIRED'
        ) {
          await this.telegram.sendContactRequest(user.telegramId);
          throw new ForbiddenException('PHONE_REQUIRED');
        }
        throw e;
      }
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }
}
