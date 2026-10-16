import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { RoomStatus, RoomType } from 'src/database/schema/room.schema';

export class CreateRoomRequestDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(5)
  stake!: number;

  @IsOptional()
  @IsInt()
  houseCutPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  maxPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  hitsToWin?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60000)
  waitingTime?: number;

  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;

  @IsOptional()
  @IsBoolean()
  autoStart?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxNoOfSessions?: number;
}

export class UpdateRoomStatusDto {
  @IsEnum(RoomStatus)
  status!: RoomStatus;
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(5)
  stake?: number;

  @IsOptional()
  @IsInt()
  houseCutPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  maxPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  hitsToWin?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60000)
  waitingTime?: number;

  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;

  @IsOptional()
  @IsBoolean()
  autoStart?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxNoOfSessions?: number;
}
