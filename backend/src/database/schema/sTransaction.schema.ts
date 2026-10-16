import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Transaction } from './transaction.schema';

export type SessionTransactionDocument = HydratedDocument<SessionTransaction>;

export enum SessionTransactionType {
  Win = 0,
  Stake = 1,
  Reward,
}

@Schema({ timestamps: true })
export class SessionTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Transaction', required: true })
  transaction!: Types.ObjectId | Transaction;

  @Prop({ required: true, enum: SessionTransactionType })
  type!: SessionTransactionType;
}

export const SessionTransactionSchema =
  SchemaFactory.createForClass(SessionTransaction);
