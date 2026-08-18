import { IsOptional, IsString, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
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

export class TargetUserParamDto {
  @IsUUID()
  targetUserId: string;
}

export class RequestIdParamDto {
  @IsUUID()
  requestId: string;
}

export interface RelationshipStatusResponse {
  targetUserId: string;
  isFollowing: boolean;
  isFollowedBy: boolean;
  connectionStatus: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'CONNECTED';
  pendingRequestId?: string;
  isBlockedByMe: boolean;
}
