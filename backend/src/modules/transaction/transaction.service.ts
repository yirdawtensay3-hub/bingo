import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SessionTransaction } from 'src/database/schema/sTransaction.schema';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
} from 'src/database/schema/transaction.schema';
import {
  PaymentMethod,
  PaymentTransaction,
  PaymentType,
} from 'src/database/schema/pTrasaction.schema';
import { User, UserDocument } from 'src/database/schema/user.schema';
import { UserService } from '../user/user.service';
import { TelegramService } from '../telegram/telegram.service';
import { PaymentTransactionDocument } from 'src/database/schema/pTrasaction.schema';

@Injectable()
export class TransactionService {
  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    @InjectModel(SessionTransaction.name)
    private sessionTransactionModel: Model<SessionTransaction>,
    @InjectModel(PaymentTransaction.name)
    private paymentTransactionModel: Model<PaymentTransactionDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly telegram: TelegramService,
  ) { }

  async create(amount: number, status: TransactionStatus, userId: string) {
    try {
      const transaction = new this.transactionModel({
        amount,
        status,
        user: new Types.ObjectId(userId),
      });
      return await transaction.save();
    } catch (error) {
      console.warn('Error creating transaction:', error);
      throw new BadRequestException('Could not create transaction');
    }
  }

  async updateStatus(transactionId: string, status: TransactionStatus) {
    try {
      const transaction = await this.transactionModel.findById(transactionId);
      if (!transaction) {
        throw new BadRequestException('Transaction not found');
      }
      transaction.status = status;
      return await transaction.save();
    } catch (error) {
      console.warn('Error updating transaction:', error);
      throw new BadRequestException('Could not update transaction');
    }
  }

  async getUserTransactions(userId: string, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      // Get session transactions
      const sessionTransactions = await this.sessionTransactionModel
        .find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate({
          path: 'transaction',
          match: { user: new Types.ObjectId(userId) },
        })
        .exec();
      const filteredSessionTransactions = sessionTransactions.filter(
        (st) => st.transaction !== null,
      );

      // Get payment transactions
      const paymentTransactions = await this.paymentTransactionModel
        .find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate({
          path: 'transaction',
          match: { user: new Types.ObjectId(userId) },
        })
        .exec();
      const filteredPaymentTransactions = paymentTransactions.filter(
        (pt) => pt.transaction !== null,
      );

      // Combine and sort by creation date
      const allTransactions = [
        ...filteredSessionTransactions.map((st) => ({
          ...st.toObject(),
          transactionType: 'session' as const,
        })),
        ...filteredPaymentTransactions.map((pt) => ({
          ...pt.toObject(),
          transactionType: 'payment' as const,
        })),
      ].sort(
        (a, b) =>
          new Date((a as any).createdAt).getTime() -
          new Date((b as any).createdAt).getTime(),
      );

      return allTransactions.slice(0, limit);
    } catch (error) {
      console.warn('Error getting user transactions:', error);
      throw new BadRequestException('Could not get user transactions');
    }
  }

  private parseAmountFromLabel(label: string): number {
    // Example: "101.00 Birr" -> 101.00
    const numeric = parseFloat(String(label).replace(/[^0-9.]/g, ''));
    if (Number.isNaN(numeric) || numeric <= 0)
      throw new BadRequestException('Invalid amount in payment response');
    return numeric;
  }

  private normalizePhone(input?: string): string | null {
    if (!input) return null;
    const digits = input.replace(/\D/g, '');
    if (digits.startsWith('251')) return digits;
    if (digits.startsWith('0')) return `251${digits.slice(1)}`;
    return digits;
  }

  async depositByReference(
    userId: string,
    reference: string,
    paymentMethod: 'telebirr' | 'cbe' = 'telebirr',
    accountSuffix?: string,
  ) {
    if (!reference) throw new BadRequestException('Reference is required');

    const API_KEY = process.env.VERIFY_API_KEY;
    if (!API_KEY)
      throw new UnauthorizedException('Verify API key not configured');

    const existingReference = await this.paymentTransactionModel.findOne({
      reference,
    });
    if (existingReference) {
      throw new BadRequestException('Reference already used');
    }

    let verificationResult;
    if (paymentMethod === 'cbe') {
      verificationResult = await this.verifyCbePayment(
        reference,
        accountSuffix,
      );
    } else {
      verificationResult = await this.verifyTelebirrPayment(reference);
    }

    const amount = verificationResult.amount;
    const transaction = await this.create(
      amount,
      TransactionStatus.Completed,
      userId,
    );
    if (!transaction)
      throw new BadRequestException('Could not create transaction');

    const paymentTransaction = new this.paymentTransactionModel({
      transaction: transaction._id,
      type: PaymentType.Deposit,
      reference,
    });
    await paymentTransaction.save();

    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $inc: { balance: amount } },
    );
    const user = await this.userModel.findById(userId);

    return {
      success: true,
      transactionId: transaction._id,
      paymentId: paymentTransaction._id,
      reward_balance: user?.reward_balance ?? 0,
      main_balance: user?.main_balance ?? 0,
      receiptNo: verificationResult.receiptNo,
      paymentDate: verificationResult.paymentDate,
      amount,
    };
  }

  private async verifyTelebirrPayment(reference: string) {
    const phoneNumber = process.env.TELEBIRR_PHONE_NUMBER;
    const creditedPartyName = process.env.TELEBIRR_CREDITED_PARTY_NAME;
    const API_KEY = process.env.VERIFY_API_KEY;

    if (!creditedPartyName)
      throw new UnauthorizedException('Credited party name not configured');
    if (!phoneNumber)
      throw new UnauthorizedException('Phone number not configured');

    const res = await fetch(
      'https://verifyapi.leulzenebe.pro/verify-telebirr',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY!,
        },
        body: JSON.stringify({ reference }),
      },
    );

    if (!res.ok) {
      throw new BadRequestException('Failed to verify Telebirr payment');
    }
    const payload: any = await res.json();
    if (!payload?.success || !payload?.data) {
      throw new BadRequestException('Telebirr payment not found');
    }

    const data = payload.data;
    if (String(data.transactionStatus).toLowerCase() !== 'completed') {
      throw new BadRequestException('Telebirr transaction not completed');
    }

    const creditedPhone = this.normalizePhone(data.creditedPartyAccountNo);
    const providedPhone = this.normalizePhone(phoneNumber);
    if (creditedPhone && creditedPhone !== providedPhone) {
      throw new BadRequestException('Phone number mismatch');
    }

    if (
      String(data.creditedPartyName).toLowerCase() !==
      creditedPartyName.toLowerCase()
    ) {
      throw new BadRequestException('Credited party name mismatch');
    }

    const amount = this.parseAmountFromLabel(data.settledAmount);

    return {
      amount,
      receiptNo: data.receiptNo,
      paymentDate: data.paymentDate,
    };
  }

  private async verifyCbePayment(reference: string, accountSuffix?: string) {
    const API_KEY = process.env.VERIFY_API_KEY;
    const cbeReceiverName = process.env.CBE_RECEIVER_NAME;
    const cbeReceiverAccount = process.env.CBE_RECEIVER_ACCOUNT;

    if (!accountSuffix)
      throw new BadRequestException(
        'Account suffix is required for CBE verification',
      );
    if (!cbeReceiverName)
      throw new UnauthorizedException('CBE receiver name not configured');
    if (!cbeReceiverAccount)
      throw new UnauthorizedException('CBE receiver account not configured');

    const res = await fetch('https://verifyapi.leulzenebe.pro/verify-cbe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY!,
      },
      body: JSON.stringify({
        reference,
        accountSuffix,
      }),
    });

    if (!res.ok) {
      throw new BadRequestException('Failed to verify CBE payment');
    }
    const payload: any = await res.json();
    if (!payload?.success) {
      throw new BadRequestException('CBE payment not found');
    }

    // Verify receiver matches our configured account
    if (payload.receiverAccount !== cbeReceiverAccount) {
      throw new BadRequestException('CBE receiver account mismatch');
    }

    if (payload.receiver.toLowerCase() !== cbeReceiverName.toLowerCase()) {
      throw new BadRequestException('CBE receiver name mismatch');
    }

    const amount = this.parseAmountFromLabel(payload.amount);

    return {
      amount,
      receiptNo: payload.reference,
      paymentDate: payload.date,
    };
  }

  async requestWithdraw(
    user: UserDocument,
    body: {
      amount: number;
      method: PaymentMethod;
      accountName?: string;
      accountNumber?: string;
    },
  ) {
    const { amount, method, accountName, accountNumber } = body || ({} as any);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }
    if (!Object.values(PaymentMethod).includes(method)) {
      throw new BadRequestException('Invalid payment method');
    }
    if ((user.main_balance || 0) < amount) {
      if ((user.reward_balance || 0) >= amount) {
        throw new BadRequestException('Withdrawals from reward balance are not allowed');
      }
      throw new BadRequestException('Insufficient balance');
    }

    const transactionInProgress = await this.transactionModel.findOne({
      user: user._id,
      status: TransactionStatus.InProgress,
    });
    if (transactionInProgress) {
      throw new BadRequestException(
        'You have a pending transaction. Please wait until it is processed.',
      );
    }

    // Create base transaction in progress
    const transaction = await this.create(
      amount,
      TransactionStatus.InProgress,
      user._id.toString(),
    );
    if (!transaction) {
      throw new BadRequestException('Could not create withdrawal transaction');
    }

    // Create payment transaction record
    const pTx = new this.paymentTransactionModel({
      transaction: transaction._id,
      type: PaymentType.Withdrawal,
      method,
      accountName,
      accountNumber,
    });
    await pTx.save();

    // Notify admin over Telegram
    const admin = await this.userService.findAdmin();
    const adminTelegramId = admin?.telegramId || process.env.ADMIN_TELEGRAM_ID;
    if (adminTelegramId) {
      const msg = [
        '💸 <b>New Withdrawal Request</b>',
        `User: ${user.firstName || ''} ${user.lastName || ''} (@${user.username || '-'} | tg:${user.telegramId})`,
        `Amount: <b>${amount}</b>`,
        `Method: <b>${method}</b>`,
        accountName ? `Account Name: ${accountName}` : undefined,
        accountNumber ? `Account Number: ${accountNumber}` : undefined,
        `Txn ID: <code>${transaction._id.toString()}</code>`,
      ]
        .filter(Boolean)
        .join('\n');
      await this.telegram.sendMessage(adminTelegramId, msg);
    }

    return {
      message: 'Withdrawal request submitted',
      transactionId: transaction._id,
      paymentTransactionId: pTx._id,
    };
  }

  async approveWithdraw(paymentTransactionId: string) {
    // Find payment transaction
    const pTx = await this.paymentTransactionModel
      .findById(paymentTransactionId)
      .populate('transaction')
      .exec();
    if (!pTx) {
      throw new BadRequestException('Payment transaction not found');
    }
    const baseTx = pTx.transaction as any as TransactionDocument;
    if (!baseTx) {
      throw new BadRequestException('Base transaction not found');
    }
    // Mark transaction completed
    await this.updateStatus(baseTx._id.toString(), TransactionStatus.Completed);

    // Notify user via Telegram if possible and decrease balance
    const userTx = await this.transactionModel
      .findById(baseTx._id)
      .populate('user')
      .exec();
    const user = (userTx?.user || null) as any as UserDocument | null;

    if (user && user._id) {
      const currentBalance = user.main_balance || 0;
      const newBalance = Math.max(0, currentBalance - baseTx.amount);
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(String(user._id)) },
        { $set: { balance: newBalance } },
      );
    }
    const telegramId = user?.telegramId;
    if (telegramId) {
      await this.telegram.sendMessage(
        telegramId,
        `✅ Your withdrawal of ${baseTx.amount} via ${pTx.method} has been completed.`,
      );
    }
    return { message: 'Withdrawal approved' };
  }

  async declineWithdraw(paymentTransactionId: string) {
    // Find payment transaction
    const pTx = await this.paymentTransactionModel
      .findById(paymentTransactionId)
      .populate('transaction')
      .exec();
    if (!pTx) {
      throw new BadRequestException('Payment transaction not found');
    }
    const baseTx = pTx.transaction as any as TransactionDocument;
    if (!baseTx) {
      throw new BadRequestException('Base transaction not found');
    }
    // Mark transaction declined
    await this.updateStatus(baseTx._id.toString(), TransactionStatus.Declined);

    // Notify user via Telegram if possible
    const userTx = await this.transactionModel
      .findById(baseTx._id)
      .populate('user')
      .exec();
    const user = (userTx?.user || null) as any as UserDocument | null;
    const telegramId = user?.telegramId;
    if (telegramId) {
      await this.telegram.sendMessage(
        telegramId,
        `❌ Your withdrawal of ${baseTx.amount} via ${pTx.method} was declined.`,
      );
    }
    return { message: 'Withdrawal declined' };
  }

  async listPendingWithdrawals(): Promise<
    Array<{
      _id: string;
      amount: number;
      method: PaymentMethod;
      userTelegramId?: string;
      accountName?: string;
      accountNumber?: string;
    }>
  > {
    const pending = await this.paymentTransactionModel
      .find({ type: PaymentType.Withdrawal })
      .populate('transaction')
      .exec();
    const results: Array<{
      _id: string;
      amount: number;
      method: PaymentMethod;
      userTelegramId?: string;
      accountName?: string;
      accountNumber?: string;
    }> = [];
    for (const item of pending) {
      const baseTx = (item as any).transaction as
        | TransactionDocument
        | undefined;
      if (!baseTx || baseTx.status !== TransactionStatus.InProgress) continue;
      const userTx = await this.transactionModel
        .findById(baseTx._id)
        .populate('user')
        .exec();
      const user = (userTx?.user || null) as any as UserDocument | null;
      results.push({
        _id: item._id.toString(),
        amount: baseTx.amount,
        method: (item as any).method,
        userTelegramId: user?.telegramId,
        accountName: (item as any).accountName,
        accountNumber: (item as any).accountNumber,
      });
    }
    return results;
  }
}
