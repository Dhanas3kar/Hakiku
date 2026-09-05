export interface User {
  id: string;
  email: string;
  isVerified: boolean;
  role: 'STUDENT' | 'MODERATOR' | 'ADMIN';
  createdAt: Date;
}

export type RealtimeEventType =
  | 'message.created'
  | 'message.deleted'
  | 'conversation.cleared'
  | 'notification.created'
  | 'notification.read'
  | 'follow.created'
  | 'follow.removed'
  | 'post.created'
  | 'confession.created';

export interface RealtimeEventEnvelope<T = any> {
  eventId: string;
  eventType: RealtimeEventType;
  entityId?: string;
  conversationId?: string;
  recipientId?: string;
  actorId?: string;
  createdAt: string;
  payload: T;
  version?: number;
}

export type PresenceStatus = 'online' | 'offline';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: string;
}

export interface TypingState {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  timestamp: string;
}

export interface CatchupRequestDto {
  conversationId?: string;
  afterAt?: string;
  afterId?: string;
  limit?: number;
}

export interface CatchupResponseDto<T = any> {
  data: T[];
  nextCursorAt: string | null;
  nextCursorId: string | null;
  hasMore: boolean;
}

