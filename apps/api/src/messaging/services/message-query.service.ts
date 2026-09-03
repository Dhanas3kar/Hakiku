import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../../db/index';
import {
  messages,
  messageMedia,
  conversationParticipants,
} from '../../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
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
    // 1. Ensure access
    await this.conversationService.getConversationById(userId, conversationId);

    let whereClause = eq(messages.conversationId, conversationId);
    const isForward = Boolean(afterAt || afterId);

    if (isForward) {
      if (afterId) {
        whereClause = and(
          whereClause,
          sql`${messages.createdAt} >= (SELECT created_at FROM messages WHERE id = ${afterId})`,
          sql`${messages.id} != ${afterId}`,
        ) as any;
      } else if (afterAt) {
        const parsed = new Date(afterAt);
        if (!isNaN(parsed.getTime())) {
          const isoTime = parsed.toISOString();
          whereClause = and(
            whereClause,
            sql`${messages.createdAt} > ${isoTime}::timestamp`,
          ) as any;
        }
      }
    } else if (cursorId) {
      whereClause = and(
        whereClause,
        sql`${messages.createdAt} <= (SELECT created_at FROM messages WHERE id = ${cursorId})`,
        sql`${messages.id} != ${cursorId}`,
      ) as any;
    } else if (cursorAt) {
      const parsed = new Date(cursorAt);
      if (!isNaN(parsed.getTime())) {
        const isoTime = parsed.toISOString();
        whereClause = and(
          whereClause,
          sql`${messages.createdAt} < ${isoTime}::timestamp`,
        ) as any;
      }
    }

    const orderByClause = isForward
      ? [sql`${messages.createdAt} ASC`, sql`${messages.id} ASC`]
      : [desc(messages.createdAt), desc(messages.id)];

    const messageRows = await db.query.messages.findMany({
      where: whereClause,
      orderBy: orderByClause as any,
      limit: limit + 1,
    });

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
      const mediaRows = await db.query.messageMedia.findMany({
        where: sql`${messageMedia.messageId} IN ${messageIds}`,
        orderBy: messageMedia.displayOrder,
      });
      const mediaMap = new Map<string, any[]>();
      for (const m of mediaRows) {
        if (!mediaMap.has(m.messageId)) mediaMap.set(m.messageId, []);
        mediaMap.get(m.messageId)!.push(m);
      }

      for (const item of items) {
        (item as any).media = mediaMap.get(item.id) || [];
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
        ),
      );

    return result?.count || 0;
  }
}
