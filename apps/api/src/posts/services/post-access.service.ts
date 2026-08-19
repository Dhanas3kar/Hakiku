import { db } from '../../db/index';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, or, sql } from 'drizzle-orm';
import { posts, users, blocks, connections } from '../../db/schema';
import * as schema from '../../db/schema';

@Injectable()
export class PostAccessService {
  private db;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  /**
   * Verify that user exists and status is ACTIVE.
   * Throws ForbiddenException if account is SUSPENDED, BANNED, or DEACTIVATED.
   */
  async verifyActiveAccount(userId: string): Promise<any> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        `Account is ${(user.status || '').toLowerCase()} and cannot perform this action`,
      );
    }

    return user;
  }

  /**
   * Centralized Post Visibility & Block Privacy Verification.
   * Returns the post object if accessible.
   * Throws NotFoundException (404) for deleted posts, non-existent posts, blocked users, or unauthorized visibilities.
   */
  async validatePostAccess(viewerId: string, postId: string): Promise<any> {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    // Check post author account status
    const [author] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, post.authorId))
      .limit(1);
    if (
      !author ||
      author.status === 'BANNED' ||
      author.status === 'DEACTIVATED'
    ) {
      throw new NotFoundException('Post not found');
    }

    // Check Phase 3 Block Isolation
    if (viewerId !== post.authorId) {
      const blockRecord = await this.db
        .select()
        .from(blocks)
        .where(
          or(
            and(
              eq(blocks.blockerId, viewerId),
              eq(blocks.blockedId, post.authorId),
            ),
            and(
              eq(blocks.blockerId, post.authorId),
              eq(blocks.blockedId, viewerId),
            ),
          ),
        )
        .limit(1);

      if (blockRecord.length > 0) {
        // Enforce Block Privacy -> Generic 404 Not Found
        throw new NotFoundException('Post not found');
      }
    }

    // Visibility Check
    if (post.visibility === 'PUBLIC') {
      return post;
    }

    if (post.visibility === 'PRIVATE') {
      if (viewerId === post.authorId) {
        return post;
      }
      throw new NotFoundException('Post not found');
    }

    if (post.visibility === 'CONNECTIONS_ONLY') {
      if (viewerId === post.authorId) {
        return post;
      }

      // Check mutual connection (canonical order: userA < userB)
      const userAId = viewerId < post.authorId ? viewerId : post.authorId;
      const userBId = viewerId < post.authorId ? post.authorId : viewerId;

      const connection = await this.db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.userAId, userAId),
            eq(connections.userBId, userBId),
          ),
        )
        .limit(1);

      if (connection.length > 0) {
        return post;
      }

      throw new NotFoundException('Post not found');
    }

    throw new NotFoundException('Post not found');
  }

  /**
   * Validate that viewer can interact (like/comment) with a post.
   * Requires viewer account to be ACTIVE and post to be accessible.
   */
  async validatePostInteraction(
    viewerId: string,
    postId: string,
  ): Promise<any> {
    await this.verifyActiveAccount(viewerId);
    return this.validatePostAccess(viewerId, postId);
  }
}
