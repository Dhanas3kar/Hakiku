import { db } from '../../db/index';
import { Injectable } from '@nestjs/common';
import { notificationOutbox } from '../../db/schema';
import * as schema from '../../db/schema';

@Injectable()
export class NotificationOutboxService {
  private db;

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  /**
   * Writes an event to the notification outbox transactionally.
   * This ensures that domain events are safely persisted alongside the business state.
   */
  async appendEvent(tx: any, eventId: string, type: any, payload: any) {
    await tx.insert(notificationOutbox).values({
      eventId,
      type,
      payload,
    }).onConflictDoNothing({ target: [notificationOutbox.eventId] });
  }
}
