import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../../db/index';
import {
  messages,
  messageMedia,
  conversationParticipants,
} from '../../db/schema';
import { eq, and, sql, desc, asc, inArray, gt, ne, lt } from 'drizzle-orm';
import { ConversationService } from './conversation.service';

@Injectable()
export class MessageQueryService {
  constructor(private readonly conversationService: ConversationService) {}

  /**
   * Retrieves messages for a conversation using deterministic cursor pagination.
   * Supports backward pagination (cursorAt, cursorId) and forward catch-up (afterAt, afterId).
   */
  async listMessages(
    userId: string,
    conversationId: string,
    cursorAt?: string,
    cursorId?: string,
    limit = 50,
    afterAt?: string,
    afterId?: string,
  ) {
    // 1. Ensure access and fetch participant clearedAt status
    await this.conversationService.getConversationById(userId, conversationId);

    const [participant] = await db
      .select({ clearedAt: conversationParticipants.clearedAt })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      )
      .limit(1);

    let anchorDate: Date | null = null;
    if (afterId) {
      const [anchor] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, afterId))
        .limit(1);

      if (anchor) {
        anchorDate = anchor.createdAt;
      }
    }

    const isForward = Boolean(afterAt || afterId);
    let whereClause: any = eq(messages.conversationId, conversationId);

    if (participant?.clearedAt) {
      const clearedTime = new Date(participant.clearedAt).toISOString();
      whereClause = and(
        whereClause,
        sql`${messages.createdAt} > ${clearedTime}::timestamp`,
      );
    }

    if (afterId && anchorDate) {
      whereClause = and(
        whereClause,
        gt(messages.createdAt, anchorDate),
        ne(messages.id, afterId),
      );
    } else if (afterAt) {
      const parsed = new Date(afterAt);
      if (!isNaN(parsed.getTime())) {
        whereClause = and(
          whereClause,
          gt(messages.createdAt, parsed),
        );
      }
    } else if (cursorAt) {
      const parsed = new Date(cursorAt);
      if (!isNaN(parsed.getTime())) {
        whereClause = and(
          whereClause,
          lt(messages.createdAt, parsed),
        );
      }
    }

    const messageRows = await db
      .select()
      .from(messages)
      .where(whereClause)
      .orderBy(
        ...(isForward
          ? [asc(messages.createdAt), asc(messages.id)]
          : [desc(messages.createdAt), desc(messages.id)])
      )
      .limit(limit + 1);

    const hasNextPage = messageRows.length > limit;
    const items = hasNextPage ? messageRows.slice(0, limit) : messageRows;

    let nextCursorAt: string | null = null;
    let nextCursorId: string | null = null;

    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursorAt = lastItem.createdAt.toISOString();
      nextCursorId = lastItem.id;
    }

    if (items.length > 0) {
      const messageIds = items.map((m) => m.id);
      const mediaRows = await db
        .select()
        .from(messageMedia)
        .where(inArray(messageMedia.messageId, messageIds))
        .orderBy(asc(messageMedia.displayOrder));
        
      const mediaMap = new Map<string, any[]>();
      for (const m of mediaRows) {
        if (!mediaMap.has(m.messageId)) mediaMap.set(m.messageId, []);
        mediaMap.get(m.messageId)!.push(m);
      }

      for (const item of items) {
        (item as any).media = item.deletedAt ? [] : (mediaMap.get(item.id) || []);
      }
    }

    return {
      data: isForward ? items : items.reverse(),
      nextCursorAt,
      nextCursorId,
    };
  }

  /**
   * Retrieves total unread messages count for a user across all conversations.
   */
  async getUnreadCount(userId: string) {
    // We join messages with conversation_participants.
    // Unread = messages.created_at > conversation_participants.last_read_at OR last_read_at IS NULL
    // AND messages.sender_id != userId
    const [result] = await db
      .select({
        count: sql<number>`COUNT(*)::int`.as('count'),
      })
      .from(messages)
      .innerJoin(
        conversationParticipants,
        and(
          eq(messages.conversationId, conversationParticipants.conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      )
      .where(
        and(
          sql`${messages.senderId} != ${userId}`,
          sql`${messages.createdAt} > COALESCE(${conversationParticipants.lastReadAt}, '1970-01-01')`,
          sql`(${conversationParticipants.clearedAt} IS NULL OR ${messages.createdAt} > ${conversationParticipants.clearedAt})`,
        ),
      );

    return result?.count || 0;
  }
}
