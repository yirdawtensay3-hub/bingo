import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export interface IUser {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  isAdmin?: boolean;
  invitedBy?: Types.ObjectId;
}

@Schema({ timestamps: true })
export class User implements IUser {
  @Prop({ required: true, unique: true, index: true })
  telegramId!: string;

  @Prop({ trim: true })
  username?: string;

  @Prop({ trim: true })
  firstName?: string;

  @Prop({ trim: true })
  lastName?: string;

  @Prop({ match: /^\+?[1-9]\d{1,14}$/, trim: true })
  phoneNumber?: string;

  @Prop({ default: 0 })
  main_balance!: number;

  @Prop({ default: 0 })
  reward_balance!: number;

  @Prop({ type: Boolean, default: false })
  isAdmin?: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedBy?: Types.ObjectId;
}

export type UserDocument = User &
  Document<Types.ObjectId> & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

export const UserSchema = SchemaFactory.createForClass(User);
