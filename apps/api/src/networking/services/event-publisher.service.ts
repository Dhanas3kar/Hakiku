import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { randomUUID as uuidv4 } from 'crypto';
import { NotificationOutboxService } from '../../notifications/services/notification-outbox.service';

export interface BaseDomainEvent {
  actorId: string;
  recipientId: string;
  timestamp: Date;
}

export interface ConnectionEventPayload extends BaseDomainEvent {
  requestId?: string;
}

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly outboxService: NotificationOutboxService,
  ) {}

  async publishFollowCreated(
    tx: any,
    actorId: string,
    recipientId: string,
  ): Promise<void> {
    const payload: BaseDomainEvent = {
      actorId,
      recipientId,
      timestamp: new Date(),
    };
    const eventId = `FOLLOW_${actorId}_${recipientId}_${Date.now()}`;
    await this.outboxService.appendEvent(tx, eventId, 'FOLLOW', {
      actorId,
      recipientId,
      entityType: 'USER',
      entityId: recipientId,
      data: payload,
    });
    this.logger.log(
      `Domain Event: NOTIFICATION_FOLLOW_CREATED [${actorId} -> ${recipientId}]`,
    );
  }

  async publishConnectionRequestSent(
    tx: any,
    actorId: string,
    recipientId: string,
    requestId: string,
  ): Promise<void> {
    const payload: ConnectionEventPayload = {
      actorId,
      recipientId,
      requestId,
      timestamp: new Date(),
    };
    const eventId = `CONN_REQ_SENT_${requestId}`;
    await this.outboxService.appendEvent(tx, eventId, 'CONNECTION_REQUEST', {
      actorId,
      recipientId,
      entityType: 'CONNECTION_REQUEST',
      entityId: requestId,
      data: payload,
    });
    this.logger.log(
      `Domain Event: NOTIFICATION_CONNECTION_REQUEST_SENT [${actorId} -> ${recipientId}, Request: ${requestId}]`,
    );
  }

  async publishConnectionAccepted(
    tx: any,
    actorId: string,
    recipientId: string,
    requestId?: string,
  ): Promise<void> {
    const payload: ConnectionEventPayload = {
      actorId,
      recipientId,
      requestId,
      timestamp: new Date(),
    };
    const eventId = `CONN_REQ_ACCEPTED_${requestId || uuidv4()}`;
    await this.outboxService.appendEvent(tx, eventId, 'CONNECTION_ACCEPTED', {
      actorId,
      recipientId,
      entityType: 'CONNECTION_REQUEST',
      entityId: requestId || 'mutual',
      data: payload,
    });
    this.logger.log(
      `Domain Event: NOTIFICATION_CONNECTION_ACCEPTED [${actorId} -> ${recipientId}]`,
    );
  }

  publishConnectionRejected(
    actorId: string,
    recipientId: string,
    requestId: string,
  ): void {
    const payload: ConnectionEventPayload = {
      actorId,
      recipientId,
      requestId,
      timestamp: new Date(),
    };
    this.logger.log(
      `Domain Event: NOTIFICATION_CONNECTION_REJECTED [${actorId} -> ${recipientId}]`,
    );
    this.eventEmitter.emit('NOTIFICATION_CONNECTION_REJECTED', payload);
  }

  publishConnectionCancelled(
    actorId: string,
    recipientId: string,
    requestId: string,
  ): void {
    const payload: ConnectionEventPayload = {
      actorId,
      recipientId,
      requestId,
      timestamp: new Date(),
    };
    this.logger.log(
      `Domain Event: NOTIFICATION_CONNECTION_CANCELLED [${actorId} -> ${recipientId}]`,
    );
    this.eventEmitter.emit('NOTIFICATION_CONNECTION_CANCELLED', payload);
  }
}
