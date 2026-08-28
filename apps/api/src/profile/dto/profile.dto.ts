import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  IsUUID,
  Min,
  Max,
  Length,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProfileVisibility {
  PUBLIC = 'PUBLIC',
  CONNECTIONS_ONLY = 'CONNECTIONS_ONLY',
  PRIVATE = 'PRIVATE',
}

export class CreateProfileDto {
  @IsString()
  @Length(3, 30)
  username: string;

  @IsString()
  @Length(2, 100)
  displayName: string;

  @IsString()
  @Length(2, 50)
  campus: string;

  @IsString()
  @Length(2, 100)
  department: string;

  @IsString()
  @Length(2, 50)
  degreeProgram: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  batchYear: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  graduationYear: number;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  bio?: string;

  @IsOptional()
  @IsEnum(ProfileVisibility)
  visibility?: ProfileVisibility = ProfileVisibility.PUBLIC;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skillIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  interestIds?: string[];

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(3, 30)
  username?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  campus?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  department?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  degreeProgram?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  batchYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  graduationYear?: number;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  bio?: string;

  @IsOptional()
  @IsEnum(ProfileVisibility)
  visibility?: ProfileVisibility;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skillIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  interestIds?: string[];

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}

export class SearchProfilesQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  campus?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  batchYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}
