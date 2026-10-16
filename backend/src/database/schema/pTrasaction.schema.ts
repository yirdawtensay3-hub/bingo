import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Transaction } from './transaction.schema';

export type PaymentTransactionDocument = HydratedDocument<PaymentTransaction>;

export enum PaymentType {
  Withdrawal = 0,
  Deposit = 1,
}

export enum PaymentMethod {
  Telebirr = 'telebirr',
  CBE = 'cbe',
}

@Schema({ timestamps: true })
export class PaymentTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Transaction', required: true })
  transaction!: Types.ObjectId | Transaction;

  @Prop({ required: true, enum: PaymentType })
  type!: PaymentType;

  @Prop({ required: true, enum: PaymentMethod })
  method!: PaymentMethod;

  // For withdrawals we need destination account info
  @Prop({ trim: true })
  accountName?: string;

  @Prop({ trim: true })
  accountNumber?: string;

  // For deposits only; must be unique when present
  @Prop({ trim: true, index: true, unique: true, sparse: true })
  reference?: string;
}

export const PaymentTransactionSchema =
  SchemaFactory.createForClass(PaymentTransaction);
