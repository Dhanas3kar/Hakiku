import { IsString, IsOptional, Length } from 'class-validator';

export class CreateSkillDto {
  @IsString()
  @Length(2, 50)
  name: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  category?: string;
}

export class CreateInterestDto {
  @IsString()
  @Length(2, 50)
  name: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  category?: string;
}

export class QueryTaxonomyDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  limit?: number = 20;
}
