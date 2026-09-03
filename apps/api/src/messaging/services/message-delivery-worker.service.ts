import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
} from '@nestjs/common';
import { eq, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/index';
import { messageOutbox } from '../../db/schema';
import { MessageDeliveryService } from './message-delivery.service';
import { Redis } from 'ioredis';

@Injectable()
export class MessageDeliveryWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MessageDeliveryWorkerService.name);
  private readonly db = db;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private activeProcessingPromise: Promise<void> | null = null;

  constructor(
    private readonly deliveryService: MessageDeliveryService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  onModuleInit() {
    this.isRunning = true;
    this.startWorker();
  }

  async onModuleDestroy() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.activeProcessingPromise) {
      await this.activeProcessingPromise;
    }
  }

  private startWorker() {
    const isTest = process.env.NODE_ENV === 'test';
    const isExplicitlyEnabled = process.env.MESSAGE_WORKER_ENABLED === 'true';
    const isExplicitlyDisabled = process.env.MESSAGE_WORKER_ENABLED === 'false';

    if (isExplicitlyDisabled || (isTest && !isExplicitlyEnabled)) {
      this.logger.log('Message delivery worker auto-polling disabled by environment config.');
      return;
    }

    this.intervalId = setInterval(() => {
      if (!this.activeProcessingPromise) {
        this.processOutbox();
      }
    }, 3000);

    // Run immediately on start
    this.processOutbox();
  }

  public async processOutbox(): Promise<void> {
    if (!this.isRunning) return;

    if (this.activeProcessingPromise) {
      await this.activeProcessingPromise;
    }

    if (!this.isRunning) return;

    const currentPromise = this.runOutboxLoop();
    this.activeProcessingPromise = currentPromise;

    try {
      await currentPromise;
    } finally {
      if (this.activeProcessingPromise === currentPromise) {
        this.activeProcessingPromise = null;
      }
    }
  }

  private async runOutboxLoop(): Promise<void> {
    try {
      // 1. Claim up to 50 pending/lease-expired events using FOR UPDATE SKIP LOCKED
      const pendingEvents = await this.db.transaction(async (tx: any) => {
        const events = await tx
          .select()
          .from(messageOutbox)
          .where(
            sql`
              (status = 'PENDING' AND available_at <= NOW() + INTERVAL '5 seconds')
              OR (status = 'PROCESSING' AND claimed_at <= NOW() - INTERVAL '5 minutes')
            `
          )
          .orderBy(messageOutbox.createdAt)
          .limit(50)
          .for('update', { skipLocked: true });

        if (events.length === 0) return [];

        const eventIds = events.map((e: any) => e.id);

        await tx
          .update(messageOutbox)
          .set({
            status: 'PROCESSING',
            claimedAt: new Date(),
            attempts: sql`${messageOutbox.attempts} + 1`,
            updatedAt: new Date(),
          })
          .where(inArray(messageOutbox.id, eventIds));

        return events.map((e: any) => ({
          ...e,
          attempts: (e.attempts || 0) + 1,
        }));
      });

      if (!pendingEvents || pendingEvents.length === 0) return;

      // 2. Process each outbox event
      for (const outboxEvent of pendingEvents) {
        if (!this.isRunning) break;

        try {
          // Publish to Redis channel 'messaging_events'
          const publishSuccess = await this.publishOutboxEvent(outboxEvent);

          if (publishSuccess) {
            await this.db
              .update(messageOutbox)
              .set({ status: 'PROCESSED', updatedAt: new Date() })
              .where(eq(messageOutbox.id, outboxEvent.id));
          } else {
            throw new Error('Redis publish failed');
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to process message outbox event ${outboxEvent.id}`,
            err.stack,
          );

          const attempts = outboxEvent.attempts || 1;
          const status = attempts >= 10 ? 'FAILED' : 'PENDING';
          const backoffMs = process.env.NODE_ENV === 'test'
            ? Math.pow(2, attempts) * 100 // Short backoff for tests
            : Math.pow(2, attempts) * 5000; // 10s, 20s, 40s... for prod

          const nextAvailable = new Date(Date.now() + backoffMs);

          try {
            await this.db
              .update(messageOutbox)
              .set({
                status,
                attempts,
                lastError: err.message || 'Unknown error',
                availableAt: nextAvailable,
                claimedAt: null,
                updatedAt: new Date(),
              })
              .where(eq(messageOutbox.id, outboxEvent.id));
          } catch (updateErr) {
            this.logger.error('Failed to update outbox failure state:', updateErr);
          }
        }
      }
    } catch (err: any) {
      this.logger.error('Error in message outbox loop:', err.stack);
    }
  }

  private async publishOutboxEvent(outboxEvent: any): Promise<boolean> {
    try {
      const channel = 'messaging_events';
      const eventData = {
        type: outboxEvent.type,
        recipientId: outboxEvent.recipientId,
        conversationId: outboxEvent.conversationId,
        payload: outboxEvent.payload,
      };

      await this.redis.publish(channel, JSON.stringify(eventData));
      return true;
    } catch (err: any) {
      this.logger.error(`Redis publish exception for outbox event ${outboxEvent.id}: ${err.message}`);
      return false;
    }
  }
}
