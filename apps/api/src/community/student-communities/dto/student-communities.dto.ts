import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum CommunityVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum CommunityRole {
  OWNER = 'OWNER',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

export enum ChannelType {
  TEXT = 'TEXT',
}

export class CreateCommunityDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  bannerUrl?: string;

  @IsEnum(CommunityVisibility)
  @IsOptional()
  visibility?: CommunityVisibility = CommunityVisibility.PUBLIC;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string = 'General';
}

export class UpdateCommunityDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  bannerUrl?: string;

  @IsEnum(CommunityVisibility)
  @IsOptional()
  visibility?: CommunityVisibility;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;
}

export class CreateChannelDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Channel slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @IsEnum(ChannelType)
  @IsOptional()
  type?: ChannelType = ChannelType.TEXT;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean = false;
}

export class UpdateChannelDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}

export class UpdateMemberRoleDto {
  @IsEnum(CommunityRole)
  @IsNotEmpty()
  role: CommunityRole;
}

export class BanMemberDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class TransferOwnershipDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID('4', { message: 'targetUserId must be a valid UUID' })
  targetUserId: string;
}

export class SendChannelMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}

export class QueryCommunitiesDto {
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : String(value).trim()))
  @IsString()
  @IsOptional()
  search?: string;

  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : String(value).trim()))
  @IsString()
  @IsOptional()
  category?: string;

  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : value))
  @IsEnum(CommunityVisibility)
  @IsOptional()
  visibility?: CommunityVisibility;

  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
