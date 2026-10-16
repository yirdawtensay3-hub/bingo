import { IsJWT, IsNumber } from 'class-validator';

export class LeaveSession {
  @IsJWT()
  sessionToken!: string;
}

export class CheckBingo {
  @IsJWT()
  sessionToken!: string;

  @IsNumber()
  boardNumber!: number;
}
