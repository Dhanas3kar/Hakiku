import { db } from '../../db/index';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { connectionRequests, connections } from '../../db/schema';
import { BlockService } from './block.service';
import { EventPublisherService } from './event-publisher.service';

@Injectable()
export class ConnectionService {
  private db;

  constructor(
    private readonly blockService: BlockService,
    private readonly eventPublisher: EventPublisherService,
  ) {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  async sendConnectionRequest(
    senderId: string,
    receiverId: string,
  ): Promise<{
    message: string;
    status: string;
    requestId?: string;
    autoAccepted?: boolean;
  }> {
    if (senderId === receiverId) {
      throw new BadRequestException(
        'You cannot send a connection request to yourself',
      );
    }

    // 1. Block Privacy Interceptor
    if (await this.blockService.isBlockedByTarget(senderId, receiverId)) {
      throw new NotFoundException('User not found');
    }

    const receiverProfile = await this.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, receiverId))
      .limit(1);

    if (receiverProfile.length > 0 && receiverProfile[0].isVerifiedIdentity) {
      throw new BadRequestException(
        'You cannot connect with official verified accounts. You can follow them instead.',
      );
    }

    if (await this.blockService.isBlockedByMe(senderId, receiverId)) {
      throw new BadRequestException(
        'Please unblock the user before sending a connection request',
      );
    }

    const minId = senderId < receiverId ? senderId : receiverId;
    const maxId = senderId < receiverId ? receiverId : senderId;

    // 2. Check if already connected
    const existingConnection = await this.db
      .select()
      .from(connections)
      .where(
        and(eq(connections.userAId, minId), eq(connections.userBId, maxId)),
      )
      .limit(1);

    if (existingConnection.length > 0) {
      throw new ConflictException('You are already connected with this user');
    }

    // 3. Transaction for Mutual Request Auto-Acceptance & Pending Request Creation
    return await this.db.transaction(async (tx: any) => {
      // Check if reverse request (receiverId -> senderId) is PENDING
      const reverseRequest = await tx
        .select()
        .from(connectionRequests)
        .where(
          and(
            eq(connectionRequests.senderId, receiverId),
            eq(connectionRequests.receiverId, senderId),
            eq(connectionRequests.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (reverseRequest.length > 0) {
        // AUTO-ACCEPT MUTUAL REQUEST
        // Mark reverse request B->A as ACCEPTED
        await tx
          .update(connectionRequests)
          .set({ status: 'ACCEPTED', updatedAt: new Date() })
          .where(eq(connectionRequests.id, reverseRequest[0].id));

        // Create reciprocal historical request entry A->B directly marked as ACCEPTED (historical intent)
        await tx.insert(connectionRequests).values({
          senderId,
          receiverId,
          status: 'ACCEPTED',
          updatedAt: new Date(),
        });

        // Create canonical connection
        await tx
          .insert(connections)
          .values({ userAId: minId, userBId: maxId })
          .onConflictDoNothing({
            target: [connections.userAId, connections.userBId],
          });

        // Emit exactly ONE connection accepted event
        await this.eventPublisher.publishConnectionAccepted(
          tx,
          senderId,
          receiverId,
          reverseRequest[0].id,
        );

        return {
          message:
            'Connection request auto-accepted due to mutual pending request',
          status: 'ACCEPTED',
          autoAccepted: true,
        };
      }

      // Check if current user already has a PENDING request to receiver
      const existingPending = await tx
        .select()
        .from(connectionRequests)
        .where(
          and(
            eq(connectionRequests.senderId, senderId),
            eq(connectionRequests.receiverId, receiverId),
            eq(connectionRequests.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (existingPending.length > 0) {
        throw new ConflictException(
          'A connection request is already pending with this user',
        );
      }

      // Create new PENDING connection request
      const [inserted] = await tx
        .insert(connectionRequests)
        .values({
          senderId,
          receiverId,
          status: 'PENDING',
        })
        .returning();

      await this.eventPublisher.publishConnectionRequestSent(
        tx,
        senderId,
        receiverId,
        inserted.id,
      );

      return {
        message: 'Connection request sent successfully',
        status: 'PENDING',
        requestId: inserted.id,
      };
    });
  }

  async acceptConnectionRequest(
    receiverId: string,
    requestId: string,
  ): Promise<{ message: string }> {
    return await this.db.transaction(async (tx: any) => {
      const [req] = await tx
        .select()
        .from(connectionRequests)
        .where(
          and(
            eq(connectionRequests.id, requestId),
            eq(connectionRequests.receiverId, receiverId),
            eq(connectionRequests.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (!req) {
        throw new NotFoundException(
          'Pending connection request not found or unauthorized',
        );
      }

      // Check block state before accepting
      if (await this.blockService.isBlocked(req.senderId, req.receiverId)) {
        throw new BadRequestException(
          'Cannot accept connection request due to block constraints',
        );
      }

      const minId =
        req.senderId < req.receiverId ? req.senderId : req.receiverId;
      const maxId =
        req.senderId < req.receiverId ? req.receiverId : req.senderId;

      // Update request to ACCEPTED
      await tx
        .update(connectionRequests)
        .set({ status: 'ACCEPTED', updatedAt: new Date() })
        .where(eq(connectionRequests.id, requestId));

      // Insert into connections
      await tx
        .insert(connections)
        .values({ userAId: minId, userBId: maxId })
        .onConflictDoNothing({
          target: [connections.userAId, connections.userBId],
        });

      await this.eventPublisher.publishConnectionAccepted(
        tx,
        receiverId,
        req.senderId,
        requestId,
      );

      return { message: 'Connection request accepted successfully' };
    });
  }

  async rejectConnectionRequest(
    receiverId: string,
    requestId: string,
  ): Promise<{ message: string }> {
    const [req] = await this.db
      .select()
      .from(connectionRequests)
      .where(
        and(
          eq(connectionRequests.id, requestId),
          eq(connectionRequests.receiverId, receiverId),
          eq(connectionRequests.status, 'PENDING'),
        ),
      )
      .limit(1);

    if (!req) {
      throw new NotFoundException(
        'Pending connection request not found or unauthorized',
      );
    }

    await this.db
      .update(connectionRequests)
      .set({ status: 'REJECTED', updatedAt: new Date() })
      .where(eq(connectionRequests.id, requestId));

    this.eventPublisher.publishConnectionRejected(
      receiverId,
      req.senderId,
      requestId,
    );

    return { message: 'Connection request rejected' };
  }

  async cancelConnectionRequest(
    senderId: string,
    requestId: string,
  ): Promise<{ message: string }> {
    const [req] = await this.db
      .select()
      .from(connectionRequests)
      .where(
        and(
          eq(connectionRequests.id, requestId),
          eq(connectionRequests.senderId, senderId),
          eq(connectionRequests.status, 'PENDING'),
        ),
      )
      .limit(1);

    if (!req) {
      throw new NotFoundException(
        'Pending connection request not found or unauthorized',
      );
    }

    await this.db
      .update(connectionRequests)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(eq(connectionRequests.id, requestId));

    this.eventPublisher.publishConnectionCancelled(
      senderId,
      req.receiverId,
      requestId,
    );

    return { message: 'Connection request cancelled' };
  }

  async removeConnection(
    userId: string,
    targetUserId: string,
  ): Promise<{ message: string }> {
    if (userId === targetUserId) {
      throw new BadRequestException('Invalid target user');
    }

    const minId = userId < targetUserId ? userId : targetUserId;
    const maxId = userId < targetUserId ? targetUserId : userId;

    const deleted = await this.db
      .delete(connections)
      .where(
        and(eq(connections.userAId, minId), eq(connections.userBId, maxId)),
      )
      .returning();

    if (deleted.length === 0) {
      throw new NotFoundException('Active connection not found');
    }

    return { message: 'Connection removed successfully' };
  }
}
