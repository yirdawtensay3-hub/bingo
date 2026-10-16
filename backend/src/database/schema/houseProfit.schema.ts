import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HouseProfitDocument = HydratedDocument<HouseProfit>;

@Schema({ timestamps: true })
export class HouseProfit {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  room!: Types.ObjectId;

  @Prop({ default: 0 })
  totalProfit!: number;
}

export const HouseProfitSchema = SchemaFactory.createForClass(HouseProfit);
