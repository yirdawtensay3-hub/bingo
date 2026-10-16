import { IsIn, IsInt, IsISO8601, IsMongoId, Max, Min } from 'class-validator';

export class PublishCalledNumberDto {
  @IsMongoId()
  roomId!: string;

  @IsInt()
  @Min(1)
  @Max(75)
  number!: number;

  @IsInt()
  @Min(1)
  @Max(75)
  count!: number;

  @IsISO8601()
  timestamp!: string;
}
