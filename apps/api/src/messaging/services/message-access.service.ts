import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '../../db/index';
import { connections, blocks, users } from '../../db/schema';
import { eq, and, or } from 'drizzle-orm';

@Injectable()
export class MessageAccessService {
  constructor() {}

  /**
   * Validates if two users can message each other.
   * Rules:
   * 1. Sender and recipient are ACTIVE.
   * 2. Neither user has blocked the other.
   * 3. Admin / Moderator handles have special direct messaging access.
   * 4. Otherwise, both users must be mutually CONNECTED.
   */
  async validateMessagingAccess(
    senderId: string,
    recipientId: string,
  ): Promise<void> {
    if (senderId === recipientId) {
      throw new ForbiddenException('Cannot message yourself');
    }

    // 1. Check if recipient exists and is active
    const [recipient] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, recipientId), eq(users.status, 'ACTIVE')))
      .limit(1);

    if (!recipient) {
      throw new NotFoundException('User not found');
    }

    // 2. Check for blocks
    const [hasBlock] = await db
      .select()
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, senderId), eq(blocks.blockedId, recipientId)),
          and(eq(blocks.blockerId, recipientId), eq(blocks.blockedId, senderId)),
        ),
      )
      .limit(1);

    if (hasBlock) {
      throw new NotFoundException('User not found'); // Generic 404 for privacy
    }

    // 3. Admin & Moderator special messaging access bypass
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, senderId))
      .limit(1);

    const isSenderAdmin = ['ADMIN', 'MODERATOR'].includes(sender?.role || '');
    const isRecipientAdmin = ['ADMIN', 'MODERATOR'].includes(recipient?.role || '');

    if (isSenderAdmin || isRecipientAdmin) {
      return; // Admins and Moderators can message any user directly!
    }

    // 4. Check for active connection
    const { userAId, userBId } = this.getCanonicalParticipants(
      senderId,
      recipientId,
    );

    const [hasConnection] = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.userAId, userAId),
          eq(connections.userBId, userBId),
        ),
      )
      .limit(1);

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
