import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '../../db/index';
import {
  conversations,
  conversationParticipants,
  users,
  profiles,
  messages,
} from '../../db/schema';
import { eq, and, sql, desc, or, inArray } from 'drizzle-orm';
import { MessageAccessService } from './message-access.service';

@Injectable()
export class ConversationService {
  constructor(private readonly accessService: MessageAccessService) {}

  /**
   * Retrieves or creates a conversation between two users.
   * Throws if messaging access rules are violated.
   */
  async getOrCreateConversation(userId: string, targetUserId: string) {
    await this.accessService.validateMessagingAccess(userId, targetUserId);

    const { userAId, userBId } = this.accessService.getCanonicalParticipants(
      userId,
      targetUserId,
    );

    // Try to find existing conversation
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.userAId, userAId),
        eq(conversations.userBId, userBId),
      ),
    });

    if (conversation) {
      return conversation;
    }

    // Attempt to create inside a transaction to ensure both participants are added
    return await db.transaction(async (tx) => {
      try {
        const [newConversation] = await tx
          .insert(conversations)
          .values({
            userAId,
            userBId,
          })
          .returning();

        await tx.insert(conversationParticipants).values([
          { conversationId: newConversation.id, userId: userAId },
          { conversationId: newConversation.id, userId: userBId },
        ]);

        return newConversation;
      } catch (err: any) {
        // Handle concurrent creation attempt (unique constraint violation on user_a_id, user_b_id)
        if (err.code === '23505') {
          const existing = await tx.query.conversations.findFirst({
            where: and(
              eq(conversations.userAId, userAId),
              eq(conversations.userBId, userBId),
            ),
          });
          if (existing) return existing;
        }
        throw err;
      }
    });
  }

  /**
   * Lists conversations for a user, paginated.
   */
  async listConversations(userId: string, cursorAt?: string, limit = 20) {
    let whereClause = eq(conversationParticipants.userId, userId);

    if (cursorAt) {
      const parsedCursor = new Date(cursorAt);
      if (!isNaN(parsedCursor.getTime())) {
        whereClause = and(
          whereClause,
          sql`${conversations.updatedAt} < ${parsedCursor.toISOString()}`,
        ) as any;
      }
    }

    // We join participants to conversations, and then join the OTHER participant to get their profile info
    const participantRows = await db
      .select({
        conversationId: conversations.id,
        lastMessageAt: conversations.lastMessageAt,
        lastMessageId: conversations.lastMessageId,
        updatedAt: conversations.updatedAt,
        unreadCount: sql<number>`(
        SELECT COUNT(*)::int FROM messages m 
        WHERE m.conversation_id = conversations.id 
        AND m.created_at > COALESCE(conversation_participants.last_read_at, '1970-01-01')
        AND m.sender_id != ${userId}
      )`.as('unread_count'),
        targetUserId: sql<string>`CASE WHEN conversations.user_a_id = ${userId} THEN conversations.user_b_id ELSE conversations.user_a_id END`,
      })
      .from(conversationParticipants)
      .innerJoin(
        conversations,
        eq(conversationParticipants.conversationId, conversations.id),
      )
      .where(whereClause)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit + 1);

    const hasNextPage = participantRows.length > limit;
    const items = hasNextPage
      ? participantRows.slice(0, limit)
      : participantRows;

    const nextCursor =
      items.length > 0 ? items[items.length - 1].updatedAt.toISOString() : null;

    // Fetch targets' profiles
    if (items.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const targetIds = items.map((i) => i.targetUserId);
    const targets = await db
      .select({
        id: users.id,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
      })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(inArray(users.id, targetIds));

    const targetMap = new Map(targets.map((t) => [t.id, t]));

    // Fetch latest messages
    const lastMessageIds = items.map((i) => i.lastMessageId).filter(Boolean) as string[];
    let latestMessagesMap = new Map<string, any>();
    if (lastMessageIds.length > 0) {
      const msgs = await db.select().from(messages).where(inArray(messages.id, lastMessageIds));
      latestMessagesMap = new Map(msgs.map(m => [m.id, m]));
    }

    const data = items.map((item) => ({
      id: item.conversationId,
      lastMessageAt: item.lastMessageAt,
      lastMessageId: item.lastMessageId,
      updatedAt: item.updatedAt,
      unreadCount: item.unreadCount,
      latestMessage: item.lastMessageId ? latestMessagesMap.get(item.lastMessageId) || null : null,
      targetUser: targetMap.has(item.targetUserId)
        ? {
            ...targetMap.get(item.targetUserId),
            avatarUrl: targetMap.get(item.targetUserId)!.avatarKey
              ? `${process.env.BASE_URL || 'http://localhost:3001'}/uploads/${targetMap.get(item.targetUserId)!.avatarKey}`
              : null,
          }
        : null,
    }));

    return {
      items: data,
      nextCursor,
      hasMore: hasNextPage,
    };
  }

  async getConversationById(userId: string, conversationId: string) {
    const rows = await db
      .select({
        conversation: conversations,
      })
      .from(conversationParticipants)
      .innerJoin(
        conversations,
        eq(conversationParticipants.conversationId, conversations.id),
      )
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('Conversation not found');
    }

    return rows[0].conversation;
  }
}
