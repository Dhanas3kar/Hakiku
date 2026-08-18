import { db } from '../../db/index';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { eq, sql, and, lte, or, inArray } from 'drizzle-orm';
import { notificationOutbox, notifications, notificationEvents } from '../../db/schema';
import * as schema from '../../db/schema';
import { NotificationPrivacyService } from './notification-privacy.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationGateway } from '../notification.gateway';

@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private db;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly privacyService: NotificationPrivacyService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly gateway: NotificationGateway
  ) {
    const connectionString = process.env.DATABASE_URL || 'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  onModuleInit() {
    this.isRunning = true;
    this.startWorker();
  }

  async onModuleDestroy() {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private startWorker() {
    this.intervalId = setInterval(() => this.processOutbox(), 5000);
    // Run immediately on start
    this.processOutbox();
  }

  private async processOutbox() {
    if (!this.isRunning) return;

    try {
      await this.db.transaction(async (tx: any) => {
        // Fetch up to 50 pending events, locking them
        const pendingEvents = await tx.execute(
          sql`
            SELECT * FROM notification_outbox
            WHERE status IN ('PENDING', 'PROCESSING')
              AND available_at <= NOW()
            ORDER BY created_at ASC
            LIMIT 50
            FOR UPDATE SKIP LOCKED
          `
        );

        if (pendingEvents.length === 0) return;

        const eventIds = pendingEvents.map((e: any) => e.id);

        // Mark as PROCESSING
        await tx
          .update(notificationOutbox)
          .set({ status: 'PROCESSING', updatedAt: new Date() })
          .where(inArray(notificationOutbox.id, eventIds));

        for (const outboxEvent of pendingEvents) {
          try {
            await this.handleEvent(tx, outboxEvent);
            
            // Mark as PROCESSED
            await tx
              .update(notificationOutbox)
              .set({ status: 'PROCESSED', updatedAt: new Date() })
              .where(eq(notificationOutbox.id, outboxEvent.id));
              
          } catch (err: any) {
            this.logger.error(`Failed to process outbox event ${outboxEvent.id}`, err.stack);
            
            const attempts = outboxEvent.attempts + 1;
            const status = attempts >= 5 ? 'FAILED' : 'PENDING';
            // Exponential backoff: 2^attempts * 30 seconds
            const nextAvailable = new Date(Date.now() + Math.pow(2, attempts) * 30000);
            
            await tx
              .update(notificationOutbox)
              .set({
                status,
                attempts,
                lastError: err.message || 'Unknown error',
                availableAt: nextAvailable,
                updatedAt: new Date()
              })
              .where(eq(notificationOutbox.id, outboxEvent.id));
          }
        }
      });
    } catch (err) {
      this.logger.error('Outbox worker transaction failed', err);
    }
  }

  private async handleEvent(tx: any, outboxEvent: any) {
    const { event_id: eventId, type, payload } = outboxEvent;

    // Idempotency check
    const [existingEvent] = await tx
      .select()
      .from(notificationEvents)
      .where(eq(notificationEvents.eventId, eventId))
      .limit(1);

    if (existingEvent) {
      return; // Already processed
    }

    // Register idempotency
    await tx.insert(notificationEvents).values({ eventId });

    // Payload includes recipientId, actorId, entityType, entityId
    const { recipientId, actorId, entityType, entityId, data } = payload;

    // Evaluate block privacy
    if (recipientId && actorId && recipientId !== actorId) {
      const canDeliver = await this.privacyService.canDeliverNotification(recipientId, actorId);
      if (!canDeliver) return; // Drop silently
    }

    // Evaluate preferences
    if (recipientId) {
      const shouldDeliver = await this.preferenceService.shouldDeliverInApp(recipientId, type);
      if (!shouldDeliver) return; // Drop silently
    }

    if (recipientId) {
      // Create notification
      const [inserted] = await tx
        .insert(notifications)
        .values({
          recipientId,
          actorId: actorId || null,
          type,
          entityType,
          entityId,
          payload: data || {},
        })
        .returning();

      // Dispatch to WebSocket Gateway
      this.gateway.sendToUser(recipientId, 'new_notification', inserted);
    }
  }
}
