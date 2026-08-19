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

    // Verify message exists in conversation
    const message = await db.query.messages.findFirst({
      where: and(
        eq(messages.id, messageId),
        eq(messages.conversationId, conversationId),
      ),
    });

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
}
