import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BingoBoardDocument = BingoBoard & Document;

@Schema({ timestamps: true })
export class BingoBoard {
  @Prop({ required: true, index: true })
  boardId!: number;

  @Prop({ required: true })
  numbers!: number[]; // length 25
}

export const BingoBoardSchema = SchemaFactory.createForClass(BingoBoard);
