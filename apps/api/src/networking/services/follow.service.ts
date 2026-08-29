import { db } from '../../db/index';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { follows } from '../../db/schema';
import * as schema from '../../db/schema';
import { BlockService } from './block.service';
import { EventPublisherService } from './event-publisher.service';

@Injectable()
export class FollowService {
  private db;

  constructor(
    private readonly blockService: BlockService,
    private readonly eventPublisher: EventPublisherService,
  ) {
    this.db = db;
  }

  async followUser(
    followerId: string,
    followingId: string,
  ): Promise<{ message: string }> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Block Privacy Check: If target blocked current user, return 404
    if (await this.blockService.isBlockedByTarget(followerId, followingId)) {
      throw new NotFoundException('User not found');
    }

    // Blocker Check: If current user blocked target, must unblock first
    if (await this.blockService.isBlockedByMe(followerId, followingId)) {
      throw new BadRequestException('Please unblock the user before following');
    }

    try {
      await this.db.transaction(async (tx: any) => {
        await tx.insert(follows).values({ followerId, followingId });
        await this.eventPublisher.publishFollowCreated(
          tx,
          followerId,
          followingId,
        );
      });
      return { message: 'User followed successfully' };
    } catch (err: any) {
      if (err.code === '23505' || err.cause?.code === '23505') {
        throw new ConflictException('You are already following this user');
      }
      throw err;
    }
  }

  async unfollowUser(
    followerId: string,
    followingId: string,
  ): Promise<{ message: string }> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot unfollow yourself');
    }

    const deleted = await this.db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      throw new NotFoundException('You are not following this user');
    }

    return { message: 'User unfollowed successfully' };
  }
}
