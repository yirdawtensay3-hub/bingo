import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsString()
  telegramId!: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsString()
  invitedBy?: string; // Accept it as string in the DTO
}
