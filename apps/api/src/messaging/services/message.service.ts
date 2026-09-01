import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '../../db/index';
import {
  messages,
  messageMedia,
  conversations,
  conversationParticipants,
  pendingMediaUploads,
} from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { MessageDeliveryService } from './message-delivery.service';
import { ConversationService } from './conversation.service';
import { NotificationOutboxService } from '../../notifications/services/notification-outbox.service';
import { LocalStorageProvider } from '../../profile/storage/local-storage.provider';
import * as crypto from 'crypto';

@Injectable()
export class MessageService {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly deliveryService: MessageDeliveryService,
    private readonly outboxService: NotificationOutboxService,
    private readonly storageProvider: LocalStorageProvider,
  ) {}

  /**
   * Sends a message in a conversation.
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    dto: {
      content?: string;
      messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE';
      mediaKeys?: string[];
      replyToMessageId?: string;
      idempotencyKey?: string;
    },
  ) {
    // 1. Ensure access
    const conversation = await this.conversationService.getConversationById(
      userId,
      conversationId,
    );

    if (
      dto.messageType === 'TEXT' &&
      (!dto.content || dto.content.trim().length === 0)
    ) {
      throw new BadRequestException('Text message cannot be empty');
    }
    if (dto.content && dto.content.length > 5000) {
      throw new BadRequestException('Message too long');
    }

    let validMedia: any[] = [];
    if (dto.messageType !== 'TEXT') {
      if (!dto.mediaKeys || dto.mediaKeys.length === 0) {
        throw new BadRequestException(
          'Media message must contain at least one media key',
        );
      }

      // Verify pending uploads
      validMedia = await db.query.pendingMediaUploads.findMany({
        where: and(
          eq(pendingMediaUploads.userId, userId),
          eq(pendingMediaUploads.isAttached, false),
        ),
      });
      validMedia = validMedia.filter((m) =>
        dto.mediaKeys!.includes(m.storageKey),
      );

      if (validMedia.length !== dto.mediaKeys.length) {
        throw new BadRequestException('Invalid or unowned media keys provided');
      }

      // We should verify they exist on S3 via HEAD, skipped for brevity but StorageProvider has a way.
    }

    const newMessageId = crypto.randomUUID();
    const now = new Date();

    try {
      const createdMessage = await db.transaction(async (tx) => {
        // 2. Insert message
        const [msg] = await tx
          .insert(messages)
          .values({
            id: newMessageId,
            conversationId,
            senderId: userId,
            content: dto.content,
            messageType: dto.messageType,
            replyToMessageId: dto.replyToMessageId,
            idempotencyKey: dto.idempotencyKey,
          })
          .returning();

        // 3. Insert media
      if (validMedia.length > 0) {
        const mediaValues = validMedia.map((m, index) => ({
          messageId: newMessageId,
          storageKey: m.storageKey,
          mimeType: m.mimeType,
          fileSize: m.fileSize,
          displayOrder: index,
        }));
        await tx.insert(messageMedia).values(mediaValues);

        // Mark pending as Attached
        for (const m of validMedia) {
          await tx
            .update(pendingMediaUploads)
            .set({ isAttached: true })
            .where(eq(pendingMediaUploads.id, m.id));
        }
      }

      // 4. Update conversation last message pointer
      await tx
        .update(conversations)
        .set({
          lastMessageAt: now,
          lastMessageId: newMessageId,
          updatedAt: now,
        })
        .where(eq(conversations.id, conversationId));

      // 5. Update outbox for notifications
      const targetUserId =
        conversation.userAId === userId
          ? conversation.userBId
          : conversation.userAId;
      await this.outboxService.appendEvent(tx, crypto.randomUUID(), 'MESSAGE', {
        actorId: userId,
        recipientId: targetUserId,
        entityType: 'CONVERSATION',
        entityId: conversationId,
        data: {
          messageId: newMessageId,
          messageType: dto.messageType,
        },
      });

      return msg;
      });

      // Fire real-time event
      const targetUserId =
        conversation.userAId === userId
          ? conversation.userBId
          : conversation.userAId;
      await this.deliveryService.publishEvent({
        type: 'message:new',
        recipientId: targetUserId,
        conversationId,
        payload: createdMessage,
      });
      // Send to sender's other devices too
      await this.deliveryService.publishEvent({
        type: 'message:new',
        recipientId: userId,
        conversationId,
        payload: createdMessage,
      });

      return createdMessage;
    } catch (err: any) {
      const code =
        err?.code ||
        err?.cause?.code ||
        err?.driverError?.code ||
        err?.originalError?.code;
      const constraint =
        err?.constraint ||
        err?.constraint_name ||
        err?.cause?.constraint ||
        err?.cause?.constraint_name ||
        err?.driverError?.constraint ||
        err?.driverError?.constraint_name ||
        '';
      const detail =
        err?.detail ||
        err?.cause?.detail ||
        err?.driverError?.detail ||
        err?.message ||
        err?.cause?.message ||
        '';

      const is23505 =
        code === '23505' ||
        String(err).includes('23505') ||
        String(err?.cause).includes('23505');
      const isIdempotencyConflict =
        is23505 &&
        (constraint.includes('idempotency') ||
          detail.includes('idempotency_key') ||
          detail.includes('idempotency') ||
          String(err).includes('idempotency'));

      if (dto.idempotencyKey && isIdempotencyConflict) {
        for (let attempt = 0; attempt < 10; attempt++) {
          const [existingMessage] = await db
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.senderId, userId),
                eq(messages.idempotencyKey, dto.idempotencyKey),
              ),
            )
            .limit(1);

          if (existingMessage) {
            return existingMessage;
          }
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      }
      throw err;
    }
  }

  /**
   * Edit a message
   */
  async editMessage(userId: string, messageId: string, content: string) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Text message cannot be empty');
    }
    if (content.length > 5000) {
      throw new BadRequestException('Message too long');
    }

    const message = await db.query.messages.findFirst({
      where: eq(messages.id, messageId),
    });

    if (!message || message.senderId !== userId || message.deletedAt) {
      throw new ForbiddenException('Cannot edit this message');
    }

    if (message.messageType !== 'TEXT') {
      throw new BadRequestException('Only TEXT messages can be edited');
    }

    const [updatedMessage] = await db
      .update(messages)
      .set({ content, editedAt: new Date() })
      .where(eq(messages.id, messageId))
      .returning();

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, message.conversationId),
    });

    if (conversation) {
      const targetUserId =
        conversation.userAId === userId
          ? conversation.userBId
          : conversation.userAId;
      const eventPayload = {
        type: 'message:updated' as const,
        recipientId: targetUserId,
        conversationId: message.conversationId,
        payload: updatedMessage,
      };
      await this.deliveryService.publishEvent(eventPayload);
      eventPayload.recipientId = userId;
      await this.deliveryService.publishEvent(eventPayload);
    }

    return updatedMessage;
  }

  /**
   * Soft delete a message
   */
  async deleteMessage(userId: string, messageId: string) {
    const message = await db.query.messages.findFirst({
      where: eq(messages.id, messageId),
    });

    if (!message || message.senderId !== userId || message.deletedAt) {
      throw new ForbiddenException('Cannot delete this message');
    }

    const [deletedMessage] = await db
      .update(messages)
      .set({ deletedAt: new Date(), content: null }) // Wipe content on delete
      .where(eq(messages.id, messageId))
      .returning();

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, message.conversationId),
    });

    if (conversation) {
      const targetUserId =
        conversation.userAId === userId
          ? conversation.userBId
          : conversation.userAId;
      const eventPayload = {
        type: 'message:deleted' as const,
        recipientId: targetUserId,
        conversationId: message.conversationId,
        payload: { messageId, deletedAt: deletedMessage.deletedAt },
      };
      await this.deliveryService.publishEvent(eventPayload);
      eventPayload.recipientId = userId;
      await this.deliveryService.publishEvent(eventPayload);
    }

    return deletedMessage;
  }
}
