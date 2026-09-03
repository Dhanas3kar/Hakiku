import { IsString, IsOptional, IsBoolean, IsArray, IsEnum, MaxLength, IsNotEmpty } from 'class-validator';

export class SubmitConfessionDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  campus?: string;
}

export class CreatePollDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsArray()
  @IsString({ each: true })
  options: string[];

  @IsBoolean()
  @IsOptional()
  isMultipleChoice?: boolean;

  @IsString()
  @IsOptional()
  campus?: string;
}

export class VoteOnPollDto {
  @IsString()
  @IsNotEmpty()
  optionId: string;
}

export class RemoveVoteDto {
  @IsString()
  @IsOptional()
  optionId?: string;
}

export class CreateHotTakeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  content: string;

  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  place?: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsString()
  @IsOptional()
  media?: string;

  @IsString()
  @IsOptional()
  otherDetails?: string;
}

export enum ReportTargetType {
  CONFESSION = 'CONFESSION',
  POLL = 'POLL',
  POST = 'POST',
  COMMENT = 'COMMENT',
  USER = 'USER',
  HOT_TAKE = 'HOT_TAKE',
}

export class ReportContentDto {
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
