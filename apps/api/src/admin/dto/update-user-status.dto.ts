import { IsIn, IsString } from 'class-validator';

export class UpdateUserStatusDto {
  @IsIn(['ACTIVE', 'BANNED', 'SUSPENDED'])
  status: 'ACTIVE' | 'BANNED' | 'SUSPENDED';

  @IsString()
  reason: string;
}
