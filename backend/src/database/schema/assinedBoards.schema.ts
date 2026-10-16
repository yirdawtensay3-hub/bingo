import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type AssignedBoardDocument = HydratedDocument<AssignedBoard>;

@Schema({ timestamps: true })
export class AssignedBoard extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GameSession', required: true })
  gameSessionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Board', required: true })
  boardId!: Types.ObjectId;
}

export const AssignedCardSchema = SchemaFactory.createForClass(AssignedBoard);
