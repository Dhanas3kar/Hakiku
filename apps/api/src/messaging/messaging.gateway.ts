import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger, Inject, OnModuleDestroy } from '@nestjs/common';
import { verifyWsClient } from '../auth/utils/ws-auth.util';
import { Redis } from 'ioredis';
import { MessageAccessService } from './services/message-access.service';
import { ConversationService } from './services/conversation.service';
import { PresenceService } from './services/presence.service';
import { MessageQueryService } from './services/message-query.service';
import { MetricsService } from '../metrics/metrics.service';

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: process.env.CORS_ALLOWED_ORIGINS 
      ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : (process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : ['http://localhost:3000']),
    credentials: true,
  },
})
export class MessagingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(MessagingGateway.name);

  // userId -> set of socket ids
  private userSockets: Map<string, Set<string>> = new Map();
  private subscriberClient: Redis;

  // Typing rate limiter map: `${userId}:${conversationId}` -> lastTimestampMs
  private typingThrottleMap: Map<string, number> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly messageAccessService: MessageAccessService,
    private readonly conversationService: ConversationService,
    private readonly presenceService: PresenceService,
    private readonly messageQueryService: MessageQueryService,
    private readonly metricsService: MetricsService,
  ) {
    this.subscriberClient = new Redis(
      process.env.REDIS_URL || 'redis://localhost:6379',
      {
        keyPrefix: process.env.REDIS_PREFIX || (process.env.NODE_ENV === 'test' ? 'test:' : 'dev:'),
        enableOfflineQueue: process.env.NODE_ENV === 'test',
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 2000),
      }
    );

    this.subscriberClient.on('error', (err) => {
      console.error('[MessagingGateway] Redis subscription error:', err.message);
    });
  }

  async onModuleDestroy() {
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
    }
  }

  afterInit() {
    this.logger.log('MessagingGateway initialized');

    this.subscriberClient.on('connect', () => {
      this.subscriberClient.subscribe('messaging_events', 'community_events', 'team_events', 'collaboration_events', (err) => {
        if (err) {
          this.logger.error('Failed to subscribe to Redis events', err);
        } else {
          this.logger.log('Subscribed to messaging_events, community_events, team_events, and collaboration_events channels');
        }
      });
    });

    this.subscriberClient.on('message', (channel, message) => {
      try {
        const event = JSON.parse(message);
        if (channel === 'messaging_events') {
          this.sendToUser(event.recipientId, event.type, event.payload);
        } else if (channel === 'community_events') {
          if (event.channelId) {
            this.server.to(`channel:${event.channelId}`).emit(event.type, event.payload || event);
          }
          this.server.emit(event.type, event.payload || event);
        } else if (channel === 'team_events' || channel === 'collaboration_events') {
          if (event.recipientId) {
            this.sendToUser(event.recipientId, event.type, event.payload || event);
          }
          this.server.emit(event.type, event.payload || event);
        }
      } catch (err) {
        this.logger.error(`Failed to parse Redis event on ${channel}`, err);
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      const userId = await verifyWsClient(client, this.jwtService);

      if (!userId) {
        client.disconnect();
        return;
      }

      client.data.userId = userId;

      let sockets = this.userSockets.get(userId);
      if (!sockets) {
        sockets = new Set();
        this.userSockets.set(userId, sockets);
      }
      sockets.add(client.id);
      this.metricsService.incrementWsConnections();
      await this.presenceService.heartbeat(userId);

      this.logger.debug(
        `Client connected to messaging: ${client.id} (User: ${userId})`,
      );
    } catch (err) {
      this.logger.warn(`Messaging connection failed: ${err.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          await this.presenceService.setOffline(userId);
        }
      }
      this.metricsService.decrementWsConnections();
      this.logger.debug(
        `Client disconnected from messaging: ${client.id} (User: ${userId})`,
      );
    }
  }

  @SubscribeMessage('presence:heartbeat')
  async handlePresenceHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      await this.presenceService.heartbeat(userId);
    }
  }

  @SubscribeMessage('message:catchup')
  async handleMessageCatchup(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      afterAt?: string;
      afterId?: string;
      limit?: number;
    },
  ) {
    const userId = client.data.userId;
    if (!userId || !data.conversationId) {
      return { error: 'Unauthorized or missing conversationId' };
    }

    try {
      const limit = Math.min(Math.max(data.limit || 50, 1), 100);
      const res = await this.messageQueryService.listMessages(
        userId,
        data.conversationId,
        undefined,
        undefined,
        limit,
        data.afterAt,
        data.afterId,
      );

      return {
        status: 'ok',
        data: res.data,
        nextCursorAt: res.nextCursorAt,
        nextCursorId: res.nextCursorId,
      };
    } catch (err: any) {
      this.logger.error(`Catchup failed for user ${userId}: ${err.message}`);
      return { status: 'error', message: err.message || 'Catchup failed' };
    }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await this.handleTyping(client, data.conversationId, 'typing:start');
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await this.handleTyping(client, data.conversationId, 'typing:stop');
  }

  private async handleTyping(
    client: Socket,
    conversationId: string,
    event: string,
  ) {
    const userId = client.data.userId;
    if (!userId || !conversationId) return;

    // Rate limiting: maximum 1 typing event / 2 seconds per user per conversation
    const throttleKey = `${userId}:${conversationId}`;
    const now = Date.now();
    const lastTimestamp = this.typingThrottleMap.get(throttleKey) || 0;
    if (now - lastTimestamp < 2000) {
      return; // Suppress throttled typing event
    }
    this.typingThrottleMap.set(throttleKey, now);

    try {
      // Ensure access and retrieve conversation to find recipient
      const conversation = await this.conversationService.getConversationById(
        userId,
        conversationId,
      );
      const targetUserId =
        conversation.userAId === userId
          ? conversation.userBId
          : conversation.userAId;

      this.sendToUser(targetUserId, event, { conversationId, userId });
    } catch (err) {
      // Ignored for typing events
    }
  }

  private sendToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.size > 0) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }
}

