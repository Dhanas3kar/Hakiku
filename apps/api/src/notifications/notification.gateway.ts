import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { verifyWsClient } from '../auth/utils/ws-auth.util';
import { Redis } from 'ioredis';

@WebSocketGateway({
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
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationGateway.name);

  // userId -> socket.id map
  private userSockets: Map<string, Set<string>> = new Map();
  private subscriberClient: Redis;

  constructor(private readonly jwtService: JwtService) {}

  afterInit() {
    this.subscriberClient = new Redis(
      process.env.REDIS_URL || 'redis://localhost:6379',
      {
        keyPrefix:
          process.env.REDIS_PREFIX ||
          (process.env.NODE_ENV === 'test' ? 'test:' : 'dev:'),
      }
    );

    this.subscriberClient.subscribe('notification_events', (err, count) => {
      if (err) {
        this.logger.error('Failed to subscribe to notification_events', err);
      } else {
        this.logger.log(`Subscribed to notification_events (count: ${count})`);
      }
    });

    this.subscriberClient.on('message', (channel, message) => {
      if (channel === 'notification_events') {
        try {
          const event = JSON.parse(message);
          this.sendToUserLocally(event.recipientId, event.type, event.payload);
        } catch (err) {
          this.logger.error(`Error parsing notification event: ${err.message}`);
        }
      }
    });

    this.logger.log('NotificationGateway initialized');
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

      this.logger.debug(`Client connected: ${client.id} (User: ${userId})`);
    } catch (err) {
      this.logger.warn(`Connection failed: ${err.message}`);
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
      this.logger.debug(`Client disconnected: ${client.id} (User: ${userId})`);
    }
  }

  /**
   * Broadcasts the event to sockets connected to *this* instance only.
   */
  private sendToUserLocally(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.size > 0) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  /**
   * (Deprecated) Do not call this directly in multi-node setups.
   * Notifications should be published via Redis instead.
   */
  sendToUser(userId: string, event: string, data: any) {
    this.sendToUserLocally(userId, event, data);
  }
}
