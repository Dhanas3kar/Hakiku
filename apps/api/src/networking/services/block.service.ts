import { db } from '../../db/index';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, or, sql } from 'drizzle-orm';
import {
  blocks,
  follows,
  connections,
  connectionRequests,
} from '../../db/schema';
import * as schema from '../../db/schema';

@Injectable()
export class BlockService {
  private db;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  async blockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{ message: string }> {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const minId = blockerId < blockedId ? blockerId : blockedId;
    const maxId = blockerId < blockedId ? blockedId : blockerId;

    await this.db.transaction(async (tx: any) => {
      // 1. Insert Block Record (Ignore if already blocked)
      await tx
        .insert(blocks)
        .values({ blockerId, blockedId })
        .onConflictDoNothing({ target: [blocks.blockerId, blocks.blockedId] });

      // 2. Delete Follows in both directions
      await tx
        .delete(follows)
        .where(
          or(
            and(
              eq(follows.followerId, blockerId),
              eq(follows.followingId, blockedId),
            ),
            and(
              eq(follows.followerId, blockedId),
              eq(follows.followingId, blockerId),
            ),
          ),
        );

      // 3. Delete Mutual Connection if exists
      await tx
        .delete(connections)
        .where(
          and(eq(connections.userAId, minId), eq(connections.userBId, maxId)),
        );

      // 4. Cancel Pending Connection Requests in both directions (with explicit parentheses)
      await tx
        .update(connectionRequests)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where(
          and(
            eq(connectionRequests.status, 'PENDING'),
            or(
              and(
                eq(connectionRequests.senderId, blockerId),
                eq(connectionRequests.receiverId, blockedId),
              ),
              and(
                eq(connectionRequests.senderId, blockedId),
                eq(connectionRequests.receiverId, blockerId),
              ),
            ),
          ),
        );
    });

    return { message: 'User blocked successfully' };
  }

  async unblockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{ message: string }> {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot unblock yourself');
    }

    const deleted = await this.db
      .delete(blocks)
      .where(
        and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)),
      )
      .returning();

    if (deleted.length === 0) {
      throw new NotFoundException('Block record not found');
    }

    return { message: 'User unblocked successfully' };
  }

  async isBlocked(userAId: string, userBId: string): Promise<boolean> {
    const result = await this.db
      .select()
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, userAId), eq(blocks.blockedId, userBId)),
          and(eq(blocks.blockerId, userBId), eq(blocks.blockedId, userAId)),
        ),
      )
      .limit(1);

    return result.length > 0;
  }

  async isBlockedByTarget(
    currentUserId: string,
    targetUserId: string,
  ): Promise<boolean> {
    const result = await this.db
      .select()
      .from(blocks)
      .where(
        and(
          eq(blocks.blockerId, targetUserId),
          eq(blocks.blockedId, currentUserId),
        ),
      )
      .limit(1);

    return result.length > 0;
  }

  async isBlockedByMe(
    currentUserId: string,
    targetUserId: string,
  ): Promise<boolean> {
    const result = await this.db
      .select()
      .from(blocks)
      .where(
        and(
          eq(blocks.blockerId, currentUserId),
          eq(blocks.blockedId, targetUserId),
        ),
      )
      .limit(1);

    return result.length > 0;
  }
}
