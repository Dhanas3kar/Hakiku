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
   */
  async listMessages(
    userId: string,
    conversationId: string,
    cursorAt?: string,
    cursorId?: string,
    limit = 50,
  ) {
    // 1. Ensure access
    await this.conversationService.getConversationById(userId, conversationId);

    let whereClause = eq(messages.conversationId, conversationId);

    if (cursorAt && cursorId) {
      const parsedCursor = new Date(cursorAt);
      if (!isNaN(parsedCursor.getTime())) {
        // Deterministic cursor: (created_at, id) < (cursorAt, cursorId)
        // using tuple comparison
        whereClause = and(
          whereClause,
          sql`(${messages.createdAt}, ${messages.id}) < (${parsedCursor.toISOString()}, ${cursorId})`,
        ) as any;
      }
    }

    const messageRows = await db.query.messages.findMany({
      where: whereClause,
      orderBy: [desc(messages.createdAt), desc(messages.id)],
      limit: limit + 1,
      with: {
        // we normally need media as well
      },
    });

    const hasNextPage = messageRows.length > limit;
    const items = hasNextPage ? messageRows.slice(0, limit) : messageRows;

    let nextCursorAt = null;
    let nextCursorId = null;

    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursorAt = lastItem.createdAt.toISOString();
      nextCursorId = lastItem.id;
    }

    // Need to manually load media because Drizzle doesn't automatically join reverse relationships
    // cleanly unless explicitly mapped in schema.ts relations. We'll do a simple IN query.
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
      data: items.reverse(), // Reverse to send oldest first for typical chat UI if needed, but pagination is backward
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
