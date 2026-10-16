import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from './user.schema';

export type TransactionDocument = HydratedDocument<Transaction>;

export enum TransactionStatus {
  InProgress = 0,
  Completed = 1,
  Declined = 2,
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId | User;

  @Prop({ required: true, float: true })
  amount!: number;

  @Prop({ required: true, enum: TransactionStatus })
  status!: TransactionStatus;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.index({ name: 1 }, { unique: false });
