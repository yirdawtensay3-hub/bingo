import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { Room } from './room.schema';

export type GameSessionDocument = GameSession & Document;

export interface Player {
  userId: Types.ObjectId | User;
  main_balance: number;
  reward_balance: number;
  stake: number;
  forfeited: boolean;
}

@Schema({ _id: false })
export class PlayerSchemaClass {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId | User;

  @Prop({ default: 0 })
  main_balance!: number;

  @Prop({ default: 0 })
  reward_balance!: number;

  @Prop({ default: 0 })
  stake!: number;

  @Prop({ default: false })
  forfeited!: boolean;
}

const PlayerSchema = SchemaFactory.createForClass(PlayerSchemaClass);

@Schema({ timestamps: true })
export class GameSession {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  room!: Types.ObjectId | Room;

  @Prop({ default: [] })
  calledNumbers!: number[];

  @Prop({ default: 0 })
  calledCount!: number;

  @Prop({ default: 'waiting', enum: ['waiting', 'active', 'finished'] })
  status!: string;

  @Prop({ type: [PlayerSchema], default: [] })
  users!: Player[];

  @Prop({ default: 0 })
  stakePool!: number;

  @Prop({ default: 0 })
  houseProfit!: number;

  @Prop()
  willStart?: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  endedAt?: Date;
}

export const GameSessionSchema = SchemaFactory.createForClass(GameSession);

GameSessionSchema.set('toJSON', {
  transform: (doc, ret) => {
    const r: any = ret;
    delete r.users;
    delete r.__v;
    delete r.houseProfit;
    return r;
  },
});

GameSessionSchema.set('toObject', {
  transform: (doc, ret) => {
    const r: any = ret;
    delete r.users;
    delete r.__v;
    delete r.houseProfit;
    return r;
  },
});
