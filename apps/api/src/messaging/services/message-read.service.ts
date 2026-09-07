import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../../db/index';
import {
  conversationParticipants,
  messageReadReceipts,
  messages,
} from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { MessageDeliveryService } from './message-delivery.service';
import { ConversationService } from './conversation.service';

@Injectable()
export class MessageReadService {
  constructor(
    private readonly deliveryService: MessageDeliveryService,
    private readonly conversationService: ConversationService,
  ) {}

  /**
   * Updates the read receipt for a user up to a specific message.
   */
  async markAsRead(userId: string, conversationId: string, messageId: string) {
    // Ensure access
    const conversation = await this.conversationService.getConversationById(
      userId,
      conversationId,
    );

    const isUuid =
      typeof messageId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        messageId,
      );

    if (!isUuid) {
      if (typeof messageId === 'string' && messageId.startsWith('temp-')) {
        return this.markConversationAsRead(userId, conversationId);
      }
      throw new NotFoundException('Message not found');
    }

    // Verify message exists in conversation
    const [message] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.conversationId, conversationId),
        ),
      )
      .limit(1);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await db.transaction(async (tx) => {
      // 1. Upsert read receipt
      await tx
        .insert(messageReadReceipts)
        .values({
          messageId,
          userId,
        })
        .onConflictDoUpdate({
          target: [messageReadReceipts.messageId, messageReadReceipts.userId],
          set: { readAt: new Date() },
        });

      // 2. Update participant's last read pointer
      await tx
        .update(conversationParticipants)
        .set({
          lastReadMessageId: messageId,
          lastReadAt: new Date(),
        })
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, userId),
          ),
        );
    });

    // Fire read receipt event
    const targetUserId =
      conversation.userAId === userId
        ? conversation.userBId
        : conversation.userAId;

    await this.deliveryService.publishEvent({
      type: 'message:read',
      recipientId: targetUserId,
      conversationId,
      payload: {
        messageId,
        readBy: userId,
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  /**
   * Updates participant's last read timestamp for an entire conversation.
   */
  async markConversationAsRead(userId: string, conversationId: string) {
    const conversation = await this.conversationService.getConversationById(
      userId,
      conversationId,
    );

    const now = new Date();
    await db
      .update(conversationParticipants)
      .set({
        lastReadAt: now,
      })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      );

    const targetUserId =
      conversation.userAId === userId
        ? conversation.userBId
        : conversation.userAId;

    await this.deliveryService.publishEvent({
      type: 'message:read',
      recipientId: targetUserId,
      conversationId,
      payload: {
        readBy: userId,
        readAt: now,
      },
    });

    return { success: true };
  }
}
