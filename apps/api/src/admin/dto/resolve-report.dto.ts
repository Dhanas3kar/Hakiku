import { IsIn, IsOptional, IsString } from 'class-validator';

export class ResolveReportDto {
  @IsIn(['DISMISS', 'REMOVE_CONTENT'])
  action: 'DISMISS' | 'REMOVE_CONTENT';

  @IsOptional()
  @IsString()
  reason?: string;
}
