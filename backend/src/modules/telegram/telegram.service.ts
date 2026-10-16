import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { UserService } from '../user/user.service';
import { TransactionService } from '../transaction/transaction.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf | null = null;

  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => TransactionService))
    private readonly transactionService: TransactionService,
  ) { }

  async onModuleInit() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN not provided. Telegram bot will not be started.',
      );
      return;
    }

    this.bot = new Telegraf(botToken);

    this.bot.start(async (ctx) => {
      try {
        const from = ctx.from;
        const user = await this.userService.findOrCreate({
          telegramId: from.id.toString(),
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
        });
        await ctx.reply(`Welcome ${user.firstName}! 🎉 You are authenticated.`);
      } catch (error) {
        this.logger.error('Error handling start command:', error);
        await ctx.reply('Sorry, there was an error processing your request.');
      }
    });

    this.bot.command('withdraw_pending', async (ctx) => {
      const fromId = ctx.from?.id?.toString();
      if (!fromId) return;
      const user = await this.userService.findByTelegramId(fromId);
      if (!user?.isAdmin) {
        return;
      }
      const items = await this.transactionService.listPendingWithdrawals();
      if (!items.length) return ctx.reply('No pending withdrawals.');
      for (const w of items) {
        const text = [
          `💸 <b>Pending Withdrawal</b>`,
          `Amount: <b>${w.amount}</b>`,
          `Method: <b>${w.method}</b>`,
          w.accountName ? `Account Name: ${w.accountName}` : undefined,
          w.accountNumber ? `Account Number: ${w.accountNumber}` : undefined,
          w.userTelegramId ? `User tg: ${w.userTelegramId}` : undefined,
          `pTx: <code>${w._id}</code>`,
        ]
          .filter(Boolean)
          .join('\n');
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Approve ✅', callback_data: `wd:approve:${w._id}` },
                { text: 'Decline ❌', callback_data: `wd:decline:${w._id}` },
              ],
            ],
          },
        } as any);
      }
    });

    // Handle contact sharing (phone number)
    this.bot.on('contact', async (ctx) => {
      try {
        const contact = ctx.message?.contact;
        const fromId = ctx.from?.id?.toString();
        
        if (!contact || !fromId) {
          return;
        }

        // Verify that the user is sharing their own contact
        if (contact.user_id?.toString() === fromId) {
          const phoneNumber = contact.phone_number;
          
          // Update user's phone number in database
          const updatedUser = await this.userService.updatePhoneNumber(
            fromId,
            phoneNumber,
          );

          if (updatedUser) {
            await ctx.reply(
              '✅ Thank you! Your phone number has been saved successfully.',
              {
                reply_markup: { remove_keyboard: true },
              } as any,
            );
            this.logger.log(`Phone number saved for user ${fromId}: ${phoneNumber}`);
          } else {
            await ctx.reply(
              '❌ Failed to save your phone number. Please try again later.',
            );
          }
        } else {
          await ctx.reply(
            '⚠️ Please share your own phone number, not someone else\'s.',
          );
        }
      } catch (error) {
        this.logger.error('Error handling contact:', error);
        await ctx.reply('Sorry, there was an error saving your phone number.');
      }
    });

    // Inline button handlers
    this.bot.on('callback_query', async (ctx) => {
      const fromId = ctx.from?.id?.toString();
      const user = fromId
        ? await this.userService.findByTelegramId(fromId)
        : null;
      if (!user?.isAdmin) {
        return ctx.answerCbQuery('Unauthorized');
      }
      const data = (ctx.callbackQuery as any)?.data as string | undefined;
      if (!data || !data.startsWith('wd:')) return ctx.answerCbQuery();
      const [, action, id] = data.split(':');
      try {
        if (action === 'approve') {
          await this.transactionService.approveWithdraw(id);
          await ctx.editMessageReplyMarkup(undefined as any);
          await ctx.answerCbQuery('Approved');
        } else if (action === 'decline') {
          await this.transactionService.declineWithdraw(id);
          await ctx.editMessageReplyMarkup(undefined as any);
          await ctx.answerCbQuery('Declined');
        } else {
          await ctx.answerCbQuery('Unknown action');
        }
      } catch (e) {
        await ctx.answerCbQuery('Error processing');
      }
    });

    this.bot.catch((err, ctx) => {
      this.logger.error('Telegram bot error:', err);
      ctx.reply('Sorry, something went wrong. Please try again later.');
    });

    this.bot
      .launch()
      .then(() => this.logger.log('✅ Telegram bot started successfully'))
      .catch((error) => {
        this.logger.error('Failed to start Telegram bot:', error);
        this.logger.warn('Continuing without Telegram bot...');
      });
  }

  async onModuleDestroy() {
    if (this.bot) {
      this.bot.stop('SIGTERM');
      this.logger.log('Telegram bot stopped');
    }
  }

  async sendMessage(telegramId: string, message: string) {
    if (!this.bot) {
      this.logger.warn('Telegram bot not initialized; cannot send message');
      return;
    }
    try {
      await this.bot.telegram.sendMessage(telegramId, message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error('Failed to send telegram message', error as any);
    }
  }

  async sendContactRequest(telegramId: string) {
    if (!this.bot) {
      this.logger.warn('Telegram bot not initialized; cannot request contact');
      return;
    }
    try {
      // Using WebApp keyboard to request contact is typical in inline mode; here we prompt user.
      await this.bot.telegram.sendMessage(
        telegramId,
        'Please share your phone number to complete verification. Tap the button below.',
        {
          reply_markup: {
            keyboard: [[{ text: 'Share phone number', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        } as any,
      );
    } catch (error) {
      this.logger.error('Failed to send contact request', error as any);
    }
  }
}
