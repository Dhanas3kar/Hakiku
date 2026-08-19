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
import { Logger, Inject } from '@nestjs/common';
import { verifyWsClient } from '../auth/utils/ws-auth.util';
import { Redis } from 'ioredis';
import { MessageAccessService } from './services/message-access.service';
import { ConversationService } from './services/conversation.service';

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: process.env.ALLOWED_ORIGIN || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ],
    credentials: true,
  },
})
export class MessagingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(MessagingGateway.name);

  // userId -> set of socket ids
  private userSockets: Map<string, Set<string>> = new Map();
  // We need a separate redis client for subscribing, otherwise pub/sub blocks other commands on the client.
  // We can either inject a duplicate or instantiate one. To be safe we instantiate for subscription.
  private subscriberClient: Redis;

  constructor(
    private readonly jwtService: JwtService,
    private readonly messageAccessService: MessageAccessService,
    private readonly conversationService: ConversationService,
  ) {
    this.subscriberClient = new Redis(
      process.env.REDIS_URL || 'redis://localhost:6379',
    );
  }

  afterInit() {
    this.logger.log('MessagingGateway initialized');

    this.subscriberClient.subscribe('messaging_events', (err) => {
      if (err)
        this.logger.error('Failed to subscribe to messaging_events', err);
    });

    this.subscriberClient.on('message', (channel, message) => {
      if (channel === 'messaging_events') {
        try {
          const event = JSON.parse(message);
          this.sendToUser(event.recipientId, event.type, event.payload);
        } catch (err) {
          this.logger.error('Failed to parse messaging event', err);
        }
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

      this.logger.debug(
        `Client connected to messaging: ${client.id} (User: ${userId})`,
      );
    } catch (err) {
      this.logger.warn(`Messaging connection failed: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.logger.debug(
        `Client disconnected from messaging: ${client.id} (User: ${userId})`,
      );
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
