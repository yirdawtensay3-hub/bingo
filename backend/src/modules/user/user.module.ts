import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { User, UserSchema } from 'src/database/schema/user.schema';
import { TransactionModule } from '../transaction/transaction.module';
import { SessionTransaction, SessionTransactionSchema } from 'src/database/schema/sTransaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: SessionTransaction.name, schema: SessionTransactionSchema },
    ]),
    forwardRef(() => TransactionModule),
  ],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule { }
