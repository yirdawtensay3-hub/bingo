import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from 'src/database/schema/user.schema';
import { TransactionService } from './transaction.service';
import { PaymentMethod } from 'src/database/schema/pTrasaction.schema';

@Controller('transaction')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly transcationService: TransactionService) {}

  @Get()
  async getTransactions(
    @Request() req: any,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    const user: UserDocument = req.user;
    const pageNum = page || 1;
    const limitNum = limit || 10;
    return await this.transcationService.getUserTransactions(
      user._id.toString(),
      pageNum,
      limitNum,
    );
  }

  @Post('deposit')
  async deposit(
    @Request() req: any,
    @Body()
    body: {
      reference: string;
      paymentMethod?: 'telebirr' | 'cbe';
      accountSuffix?: string;
    },
  ) {
    const user: UserDocument = req.user;
    return await this.transcationService.depositByReference(
      user._id.toString(),
      body?.reference,
      body?.paymentMethod || 'telebirr',
      body?.accountSuffix,
    );
  }

  @Get('deposit/info')
  async getDepositInfo() {
    return {
      phoneNumber:
        process.env.TELEBIRR_INFO_NUMBER ??
        process.env.TELEBIRR_PHONE_NUMBER ??
        '',
      creditedPartyName: process.env.TELEBIRR_CREDITED_PARTY_NAME ?? '',
      cbeReceiverName: process.env.CBE_RECEIVER_NAME ?? '',
      cbeReceiverAccount: process.env.CBE_INFO_ACCOUNT ?? '',
    };
  }

  @Post('withdraw')
  async requestWithdraw(
    @Request() req: any,
    @Body()
    body: {
      amount: number;
      method: PaymentMethod;
      accountName?: string;
      accountNumber?: string;
    },
  ) {
    const user: UserDocument = req.user;
    return await this.transcationService.requestWithdraw(user, body);
  }
}
