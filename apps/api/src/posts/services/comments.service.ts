import { db } from '../../db/index';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { posts, comments, profiles, users } from '../../db/schema';
import { PostAccessService } from './post-access.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentsQueryDto,
} from '../dto/posts.dto';
import { NotificationOutboxService } from '../../notifications/services/notification-outbox.service';

@Injectable()
export class CommentsService {
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
   * Create a flat comment on a post. Transactionally increments comments_count.
   */
  async createComment(authorId: string, postId: string, dto: CreateCommentDto) {
    await this.postAccessService.validatePostInteraction(authorId, postId);

    const trimmedContent = dto.content ? dto.content.trim() : '';
    if (!trimmedContent) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    let createdComment: any;

    await this.db.transaction(async (tx: any) => {
      const [inserted] = await tx
        .insert(comments)
        .values({
          postId,
          authorId,
          content: trimmedContent,
        })
        .returning();

      createdComment = inserted;

      await tx
        .update(posts)
        .set({
          commentsCount: sql`${posts.commentsCount} + 1`,
        })
        .where(eq(posts.id, postId));

      const [post] = await tx
        .select({ authorId: posts.authorId })
        .from(posts)
        .where(eq(posts.id, postId))
        .limit(1);

      if (post && post.authorId !== authorId) {
        const eventId = `COMMENT_${authorId}_${inserted.id}_${Date.now()}`;
        await this.outboxService.appendEvent(tx, eventId, 'POST_COMMENT', {
          actorId: authorId,
          recipientId: post.authorId,
          entityType: 'COMMENT',
          entityId: inserted.id,
          data: {
            commentId: inserted.id,
            postId,
            actorId: authorId,
            recipientId: post.authorId,
          },
        });
      }

      // Mentions Extraction
      if (trimmedContent) {
        const mentions = Array.from(
          new Set(trimmedContent.match(/@([\w._-]+)/g) || []),
        ).map((m) => m.slice(1));

        if (mentions.length > 0) {
          const { inArray } = require('drizzle-orm');
          const mentionedProfiles = await tx
            .select()
            .from(schema.profiles)
            .where(inArray(schema.profiles.username, mentions));

          for (const profile of mentionedProfiles) {
            if (profile.userId !== authorId) {
              await this.outboxService.appendEvent(
                tx,
                `COMMENT_MENTION_${inserted.id}_${profile.userId}`,
                'MENTION',
                {
                  actorId: authorId,
                  recipientId: profile.userId,
                  entityType: 'COMMENT',
                  entityId: inserted.id,
                }
              );
            }
          }
        }
      }
    });

    const [authorProfile] = await this.db
      .select({
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
        isVerifiedIdentity: profiles.isVerifiedIdentity,
      })
      .from(profiles)
      .where(eq(profiles.userId, authorId))
      .limit(1);

    return {
      ...createdComment,
      author: {
        userId: authorId,
        username: authorProfile?.username || 'user',
        displayName: authorProfile?.displayName || 'Student',
        avatarUrl: authorProfile?.avatarKey
          ? `${process.env.BASE_URL || 'http://localhost:3001'}/uploads/${authorProfile.avatarKey}`
          : null,
        isVerifiedIdentity: authorProfile?.isVerifiedIdentity || false,
      },
    };
  }

  /**
   * Get paginated flat comments for a post using deterministic cursor pagination.
   */
  async getPostComments(
    viewerId: string,
    postId: string,
    query: CommentsQueryDto,
  ) {
    await this.postAccessService.validatePostAccess(viewerId, postId);

    const limit = Math.min(query.limit || 20, 50);

    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;
    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf-8'),
        );
        cursorCreatedAt = new Date(decoded.createdAt);
        cursorId = decoded.id;
      } catch (err) {
        throw new BadRequestException('Invalid pagination cursor format');
      }
    }

    const conditions = [
      eq(comments.postId, postId),
      sql`${comments.deletedAt} IS NULL`,
    ];

    if (cursorCreatedAt && cursorId) {
      conditions.push(
        sql`(${comments.createdAt}, ${comments.id}) < (${cursorCreatedAt.toISOString()}, ${cursorId})`,
      );
    }

    const rows = await this.db
      .select()
      .from(comments)
      .where(and(...conditions))
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const pageData = hasNextPage ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasNextPage && pageData.length > 0) {
      const lastItem = pageData[pageData.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: lastItem.createdAt, id: lastItem.id }),
      ).toString('base64');
    }

    const commentsWithAuthor = await Promise.all(
      pageData.map(async (c: any) => {
        const [authorProfile] = await this.db
          .select({
            username: profiles.username,
            displayName: profiles.displayName,
            avatarKey: profiles.avatarKey,
            isVerifiedIdentity: profiles.isVerifiedIdentity,
          })
          .from(profiles)
          .where(eq(profiles.userId, c.authorId))
          .limit(1);

        return {
          ...c,
          author: {
            userId: c.authorId,
            username: authorProfile?.username || 'user',
            displayName: authorProfile?.displayName || 'Student',
            avatarUrl: authorProfile?.avatarKey
              ? `${process.env.BASE_URL || 'http://localhost:3001'}/uploads/${authorProfile.avatarKey}`
              : null,
            isVerifiedIdentity: authorProfile?.isVerifiedIdentity || false,
          },
        };
      }),
    );

    return {
      data: commentsWithAuthor,
      meta: {
        hasNextPage,
        nextCursor,
        limit,
      },
    };
  }

  /**
   * Update comment content (Author only).
   */
  async updateComment(
    authorId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    await this.postAccessService.verifyActiveAccount(authorId);

    const [existing] = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.authorId !== authorId) {
      throw new ForbiddenException(
        'Only the comment author can edit this comment',
      );
    }

    const trimmed = dto.content ? dto.content.trim() : '';
    if (!trimmed) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    const [updated] = await this.db
      .update(comments)
      .set({
        content: trimmed,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId))
      .returning();

    return updated;
  }

  /**
   * Soft delete comment (Author only). Transactionally decrements comments_count.
   */
  async deleteComment(authorId: string, commentId: string) {
    await this.postAccessService.verifyActiveAccount(authorId);

    const [existing] = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.authorId !== authorId) {
      throw new ForbiddenException(
        'Only the comment author can delete this comment',
      );
    }

    await this.db.transaction(async (tx: any) => {
      await tx
        .update(comments)
        .set({ deletedAt: new Date() })
        .where(eq(comments.id, commentId));

      await tx
        .update(posts)
        .set({
          commentsCount: sql`GREATEST(${posts.commentsCount} - 1, 0)`,
        })
        .where(eq(posts.id, existing.postId));
    });

    return { message: 'Comment deleted successfully', commentId };
  }
  /**
   * Admin soft delete comment (Bypass Author Ownership). Transactionally decrements comments_count.
   */
  async adminSoftDeleteComment(
    adminId: string,
    commentId: string,
    reason: string,
  ) {
    const [existing] = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    await this.db.transaction(async (tx: any) => {
      await tx
        .update(comments)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(comments.id, commentId));

      await tx
        .update(posts)
        .set({
          commentsCount: sql`GREATEST(${posts.commentsCount} - 1, 0)`,
        })
        .where(eq(posts.id, existing.postId));

      await tx.insert(schema.auditLogs).values({
        userId: adminId,
        event: 'ADMIN_MODERATE_COMMENT',
        metadata: { targetId: commentId, reason },
      });
    });

    return { message: 'Comment deleted successfully', commentId };
  }
}
