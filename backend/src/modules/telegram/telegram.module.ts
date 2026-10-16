import { Module, forwardRef } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { TransactionModule } from '../transaction/transaction.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [forwardRef(() => UserModule), forwardRef(() => TransactionModule)],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
