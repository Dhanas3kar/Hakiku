import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  IsInt,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export type PostVisibility = 'PUBLIC' | 'CONNECTIONS_ONLY' | 'PRIVATE';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  content?: string;

  @IsOptional()
  @IsEnum(['PUBLIC', 'CONNECTIONS_ONLY', 'PRIVATE'])
  visibility?: PostVisibility = 'PUBLIC';

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mediaUploadIds?: string[];
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  content?: string;

  @IsOptional()
  @IsEnum(['PUBLIC', 'CONNECTIONS_ONLY', 'PRIVATE'])
  visibility?: PostVisibility;
}

export class CreateCommentDto {
  @IsString()
  @Length(1, 1000)
  content: string;
}

export class UpdateCommentDto {
  @IsString()
  @Length(1, 1000)
  content: string;
}

export class CommentsQueryDto {
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

export class UserPostsQueryDto {
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
