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
    const [existingConversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.userAId, userAId),
          eq(conversations.userBId, userBId),
        ),
      )
      .limit(1);

    if (existingConversation) {
      return existingConversation;
    }

    // Insert with onConflictDoNothing for concurrent safety
    const [newConversation] = await db
      .insert(conversations)
      .values({
        userAId,
        userBId,
      })
      .onConflictDoNothing()
      .returning();

    if (!newConversation) {
      const [existing] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.userAId, userAId),
            eq(conversations.userBId, userBId),
          ),
        )
        .limit(1);
      return existing;
    }

    await db
      .insert(conversationParticipants)
      .values([
        { conversationId: newConversation.id, userId: userAId },
        { conversationId: newConversation.id, userId: userBId },
      ])
      .onConflictDoNothing();

    return newConversation;
  }

  /**
   * Lists conversations for a user, paginated.
   */
  async listConversations(userId: string, cursorAt?: string, limit = 20) {
    let whereClause = and(
      eq(conversationParticipants.userId, userId),
      sql`(${conversationParticipants.clearedAt} IS NULL OR ${conversations.lastMessageAt} > ${conversationParticipants.clearedAt})`,
    ) as any;

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
        clearedAt: conversationParticipants.clearedAt,
        unreadCount: sql<number>`(
        SELECT COUNT(*)::int FROM messages m 
        WHERE m.conversation_id = conversations.id 
        AND m.created_at > COALESCE(conversation_participants.last_read_at, '1970-01-01'::timestamp)
        AND (conversation_participants.cleared_at IS NULL OR m.created_at > conversation_participants.cleared_at)
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

    const data = items.map((item) => {
      const latestMsg = item.lastMessageId ? latestMessagesMap.get(item.lastMessageId) || null : null;
      const isCleared = item.clearedAt && latestMsg && new Date(latestMsg.createdAt) <= new Date(item.clearedAt);

      return {
        id: item.conversationId,
        lastMessageAt: item.lastMessageAt,
        lastMessageId: item.lastMessageId,
        updatedAt: item.updatedAt,
        unreadCount: item.unreadCount,
        latestMessage: isCleared ? null : latestMsg,
        targetUser: targetMap.has(item.targetUserId)
          ? {
              ...targetMap.get(item.targetUserId),
              avatarUrl: targetMap.get(item.targetUserId)!.avatarKey
                ? `${process.env.BASE_URL || 'http://localhost:3001'}/uploads/${targetMap.get(item.targetUserId)!.avatarKey}`
                : null,
            }
          : null,
      };
    });

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

  async getConversationDetails(userId: string, conversationId: string) {
    const conversation = await this.getConversationById(userId, conversationId);
    const targetUserId =
      conversation.userAId === userId ? conversation.userBId : conversation.userAId;

    const [targetProfile] = await db
      .select({
        id: users.id,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
      })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(users.id, targetUserId))
      .limit(1);

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    return {
      ...conversation,
      targetUser: targetProfile
        ? {
            ...targetProfile,
            avatarUrl: targetProfile.avatarKey
              ? `${baseUrl}/uploads/${targetProfile.avatarKey}`
              : null,
          }
        : null,
    };
  }

  /**
   * Clears/deletes a conversation for the requesting participant.
   */
  async deleteConversation(userId: string, conversationId: string) {
    const [participant] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      )
      .limit(1);

    if (!participant) {
      throw new NotFoundException('Conversation not found');
    }

    const now = new Date();
    await db
      .update(conversationParticipants)
      .set({
        clearedAt: now,
        lastReadAt: now,
        isArchived: true,
      })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      );

    return { message: 'Conversation cleared successfully' };
  }
}
