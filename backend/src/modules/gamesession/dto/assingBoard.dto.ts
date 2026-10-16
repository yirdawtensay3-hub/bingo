import { IsJWT, IsMongoId } from 'class-validator';

export class AssignBoardDto {
  @IsJWT()
  sessionToken!: string;

  @IsMongoId()
  boardId!: string;
}
