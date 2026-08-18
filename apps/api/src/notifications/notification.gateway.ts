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

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationGateway.name);

  // userId -> socket.id map
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(private readonly jwtService: JwtService) {}

  afterInit() {
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


  sendToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.size > 0) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }
}
