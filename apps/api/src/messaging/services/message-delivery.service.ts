import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface MessagingEvent {
  type:
    | 'message:new'
    | 'message:updated'
    | 'message:deleted'
    | 'message:read'
    | 'typing:start'
    | 'typing:stop';
  recipientId: string;
  conversationId: string;
  payload: any;
}

@Injectable()
export class MessageDeliveryService {
  private readonly logger = new Logger(MessageDeliveryService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Publishes a messaging event to the Redis pub/sub channel.
   * The MessagingGateway listens to this channel and dispatches events.
   */
  async publishEvent(event: MessagingEvent) {
    try {
      await this.redis.publish('messaging_events', JSON.stringify(event));
    } catch (error) {
      this.logger.error(
        `Failed to publish messaging event: ${error.message}`,
        error.stack,
      );
      // We don't throw here to ensure DB transaction isn't rolled back due to Redis failure
    }
  }
}
