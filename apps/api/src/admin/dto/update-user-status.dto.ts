import { IsIn, IsString } from 'class-validator';

export class UpdateUserStatusDto {
  @IsIn(['ACTIVE', 'BANNED'])
  status: 'ACTIVE' | 'BANNED';

  @IsString()
  reason: string;
}
