import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, IUser } from '../../database/schema/user.schema';
import { CreateUserDto } from './dto/user.dto';
import { SessionTransaction, SessionTransactionDocument, SessionTransactionType } from 'src/database/schema/sTransaction.schema';
import { type } from 'os';
import { TransactionStatus } from 'src/database/schema/transaction.schema';
import { TransactionService } from '../transaction/transaction.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(SessionTransaction.name)
    private readonly sTransactionModel: Model<SessionTransactionDocument>,
    @Inject(forwardRef(() => TransactionService))
    private transaction: TransactionService,
  ) { }

  async findOrCreate(userData: CreateUserDto): Promise<UserDocument> {
    if (!userData.telegramId) {
      throw new Error('telegramId is required');
    }

    const existingUser = await this.userModel
      .findOne({ telegramId: userData.telegramId })
      .exec();

    if (existingUser) {
      return existingUser;
    }
    const reward = parseInt(process.env.REFERRAL_REWARD ?? "0");

    if (reward > 0 && userData.invitedBy) {
      const inviter = await this.userModel.findById(userData.invitedBy).exec();
      if (inviter) {
        try {
          const transaction = await this.transaction.create(
            reward,
            TransactionStatus.Completed,
            inviter.id,
          );
          if (!transaction) {
            throw new BadRequestException('Could not create transaction');
          }
          const sessionTransaction = new this.sTransactionModel({
            transaction: transaction._id,
            type: SessionTransactionType.Reward,
          });
          await sessionTransaction.save();
        } catch (error) {
          console.warn('Error creating session transaction:', error);
          throw new BadRequestException('Could not create session transaction');
        }
        inviter.reward_balance += reward;
        await inviter.save();
      }
    }

    // Auto-assign admin if matches configured ADMIN_TELEGRAM_ID
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
    const payload: CreateUserDto = {
      ...userData,
      isAdmin:
        adminTelegramId && userData.telegramId === adminTelegramId
          ? true
          : false,
    };
    const newUser = new this.userModel(payload);
    return newUser.save();
  }

  async findByTelegramId(telegramId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ telegramId }).exec();
  }

  async create(userData: CreateUserDto): Promise<UserDocument> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }

  async findAdmin(): Promise<UserDocument | null> {
    return this.userModel.findOne({ isAdmin: true }).exec();
  }

  async updatePhoneNumber(telegramId: string, phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOneAndUpdate(
      { telegramId },
      { phoneNumber },
      { new: true }
    ).exec();
  }
}
