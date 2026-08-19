import { db } from '../../db/index';
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { posts, postLikes } from '../../db/schema';
import { PostAccessService } from './post-access.service';
import * as schema from '../../db/schema';
import { NotificationOutboxService } from '../../notifications/services/notification-outbox.service';

@Injectable()
export class LikesService {
  private db;

  constructor(
    private readonly postAccessService: PostAccessService,
    private readonly outboxService: NotificationOutboxService,
  ) {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  /**
   * Like a post. Enforces DB-level uniqueness constraint on (post_id, user_id).
   * Transactionally increments likes_count.
   */
  async likePost(userId: string, postId: string) {
    await this.postAccessService.validatePostInteraction(userId, postId);

    try {
      await this.db.transaction(async (tx: any) => {
        await tx.insert(postLikes).values({
          postId,
          userId,
        });

        await tx
          .update(posts)
          .set({
            likesCount: sql`${posts.likesCount} + 1`,
          })
          .where(eq(posts.id, postId));

        const [post] = await tx
          .select({ authorId: posts.authorId })
          .from(posts)
          .where(eq(posts.id, postId))
          .limit(1);

        if (post && post.authorId !== userId) {
          const eventId = `LIKE_${userId}_${postId}_${Date.now()}`;
          await this.outboxService.appendEvent(tx, eventId, 'POST_LIKE', {
            actorId: userId,
            recipientId: post.authorId,
            entityType: 'POST',
            entityId: postId,
            data: { postId, actorId: userId, recipientId: post.authorId },
          });
        }
      });
    } catch (err: any) {
      if (err.code === '23505' || err.cause?.code === '23505') {
        throw new ConflictException('Post is already liked by user');
      }
      throw err;
    }

    return {
      message: 'Post liked successfully',
      postId,
      isLiked: true,
    };
  }

  /**
   * Unlike a post. Transactionally decrements likes_count.
   */
  async unlikePost(userId: string, postId: string) {
    await this.postAccessService.validatePostInteraction(userId, postId);

    let found = false;

    await this.db.transaction(async (tx: any) => {
      const [existing] = await tx
        .select()
        .from(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
        .limit(1);

      if (!existing) {
        return;
      }

      found = true;

      await tx
        .delete(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));

      await tx
        .update(posts)
        .set({
          likesCount: sql`GREATEST(${posts.likesCount} - 1, 0)`,
        })
        .where(eq(posts.id, postId));
    });

    if (!found) {
      throw new NotFoundException('Like record not found for this post');
    }

    return {
      message: 'Post unliked successfully',
      postId,
      isLiked: false,
    };
  }
}
