import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class UpdatePreferencesDto {
  @IsBoolean()
  @IsOptional()
  isEmailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  isPushEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  isInAppEnabled?: boolean;
}

export class NotificationsQueryDto {
  @IsString()
  @IsOptional()
  cursor?: string;

  @IsNumber()
  @IsOptional()
  limit?: number;
}
