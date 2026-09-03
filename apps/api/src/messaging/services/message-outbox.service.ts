import { Injectable } from '@nestjs/common';
import { db } from '../../db/index';
import { messageOutbox } from '../../db/schema';

@Injectable()
export class MessageOutboxService {
  private readonly db = db;

  /**
   * Appends an event to the message outbox inside an active database transaction.
   * This guarantees that message creation and outbox event persistence are atomic.
   */
  async appendEvent(
    tx: any,
    eventId: string,
    messageId: string,
    conversationId: string,
    recipientId: string,
    type: string,
    payload: any,
  ) {
    await tx
      .insert(messageOutbox)
      .values({
        eventId,
        messageId,
        conversationId,
        recipientId,
        type,
        payload,
      })
      .onConflictDoNothing({ target: [messageOutbox.eventId] });
  }
}
