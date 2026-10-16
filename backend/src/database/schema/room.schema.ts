import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from './user.schema';
import { BingoBoardDocument } from './bingoboard.schema';

export type RoomDocument = HydratedDocument<Room>;

export enum RoomStatus {
  Waiting = 'waiting',
  Active = 'active',
  Completed = 'completed',
}

export enum RoomType {
  Public = 'public',
  Private = 'private',
}

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, trim: true })
  stake!: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId | User;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  users!: Array<Types.ObjectId | User>;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'BingoBoard' }], default: [] })
  bingoBoards!: Array<Types.ObjectId | BingoBoardDocument>;

  @Prop({ default: 0 })
  houseCutPercent!: number;

  @Prop({ type: Number, default: 100 })
  maxPlayers?: number;

  @Prop({ type: Number, default: 2 })
  minPlayers?: number;

  @Prop({ type: Number, default: 1 })
  hitsToWin?: number;

  @Prop({ type: Number, default: 5000 })
  waitingTime?: number;

  @Prop({ type: String, enum: RoomStatus, default: RoomStatus.Waiting })
  status!: RoomStatus;

  @Prop({ default: 1000 })
  intervalMs!: number;

  @Prop({ default: 10 })
  maxNoOfSessions!: number;

  @Prop({ default: false })
  autoStart!: boolean;

  @Prop({ type: String })
  roomCode?: string;

  @Prop({
    type: String,
    enum: Object.values(RoomType),
    default: RoomType.Public,
  })
  type!: RoomType;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.index({ name: 1 }, { unique: false });
