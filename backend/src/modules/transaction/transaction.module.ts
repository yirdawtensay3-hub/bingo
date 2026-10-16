import { forwardRef, Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Transaction,
  TransactionSchema,
} from 'src/database/schema/transaction.schema';
import { TransactionController } from './transaction.controller';
import {
  SessionTransaction,
  SessionTransactionSchema,
} from 'src/database/schema/sTransaction.schema';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from 'src/database/schema/pTrasaction.schema';
import { TelegramModule } from '../telegram/telegram.module';
import { UserModule } from '../user/user.module';
import { User, UserSchema } from 'src/database/schema/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: SessionTransaction.name, schema: SessionTransactionSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => TelegramModule),
    forwardRef(() => UserModule),
  ],
  providers: [TransactionService],
  exports: [TransactionService],
  controllers: [TransactionController],
})
export class TransactionModule {}
