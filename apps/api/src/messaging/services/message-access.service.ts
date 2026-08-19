import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '../../db/index';
import { connections, blocks, users } from '../../db/schema';
import { eq, and, or, sql } from 'drizzle-orm';

@Injectable()
export class MessageAccessService {
  constructor() {}

  /**
   * Validates if two users can message each other.
   * Rules:
   * 1. Sender and recipient are ACTIVE.
   * 2. Both users are mutually CONNECTED.
   * 3. Neither user has blocked the other.
   * Throws 403 Forbidden if not connected.
   * Throws 404 Not Found if blocked (to maintain privacy) or user not active/doesn't exist.
   */
  async validateMessagingAccess(
    senderId: string,
    recipientId: string,
  ): Promise<void> {
    if (senderId === recipientId) {
      throw new ForbiddenException('Cannot message yourself');
    }

    // 1. Check if recipient exists and is active
    const recipient = await db.query.users.findFirst({
      where: and(eq(users.id, recipientId), eq(users.status, 'ACTIVE')),
    });

    if (!recipient) {
      throw new NotFoundException('User not found');
    }

    // 2. Check for blocks
    const hasBlock = await db.query.blocks.findFirst({
      where: or(
        and(eq(blocks.blockerId, senderId), eq(blocks.blockedId, recipientId)),
        and(eq(blocks.blockerId, recipientId), eq(blocks.blockedId, senderId)),
      ),
    });

    if (hasBlock) {
      throw new NotFoundException('User not found'); // Generic 404 for privacy
    }

    // 3. Check for active connection
    const { userAId, userBId } = this.getCanonicalParticipants(
      senderId,
      recipientId,
    );

    const hasConnection = await db.query.connections.findFirst({
      where: and(
        eq(connections.userAId, userAId),
        eq(connections.userBId, userBId),
      ),
    });

    if (!hasConnection) {
      throw new ForbiddenException('You can only message your connections');
    }
  }

  /**
   * Orders participant IDs canonically: userA is always the smaller UUID.
   */
  getCanonicalParticipants(
    id1: string,
    id2: string,
  ): { userAId: string; userBId: string } {
    return id1 < id2
      ? { userAId: id1, userBId: id2 }
      : { userAId: id2, userBId: id1 };
  }
}
