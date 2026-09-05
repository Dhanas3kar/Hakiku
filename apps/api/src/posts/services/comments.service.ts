import { db } from '../../db/index';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, sql, desc, inArray, isNull } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { posts, comments, commentLikes, profiles, users } from '../../db/schema';
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
    this.db = db;
  }

  /**
   * Create a comment or reply on a post. Transactionally increments comments_count.
   */
  async createComment(authorId: string, postId: string, dto: CreateCommentDto) {
    await this.postAccessService.validatePostInteraction(authorId, postId);

    const trimmedContent = dto.content ? dto.content.trim() : '';
    if (!trimmedContent) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    if (dto.parentId) {
      const [parent] = await this.db
        .select()
        .from(comments)
        .where(and(eq(comments.id, dto.parentId), eq(comments.postId, postId), isNull(comments.deletedAt)))
        .limit(1);

      if (!parent) {
        throw new BadRequestException('Target comment for reply was not found');
      }
    }

    let createdComment: any;

    await this.db.transaction(async (tx: any) => {
      const [inserted] = await tx
        .insert(comments)
        .values({
          postId,
          parentId: dto.parentId || null,
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

      // Notification for comment reply
      if (dto.parentId) {
        const [parentComment] = await tx
          .select({ authorId: comments.authorId })
          .from(comments)
          .where(eq(comments.id, dto.parentId))
          .limit(1);

        if (parentComment && parentComment.authorId !== authorId && parentComment.authorId !== post?.authorId) {
          const replyEventId = `REPLY_${authorId}_${inserted.id}_${Date.now()}`;
          await this.outboxService.appendEvent(tx, replyEventId, 'COMMENT_REPLY', {
            actorId: authorId,
            recipientId: parentComment.authorId,
            entityType: 'COMMENT',
            entityId: inserted.id,
            data: {
              commentId: inserted.id,
              parentId: dto.parentId,
              postId,
              actorId: authorId,
              recipientId: parentComment.authorId,
            },
          });
        }
      }

      // Mentions Extraction
      if (trimmedContent) {
        const mentions = Array.from(
          new Set(trimmedContent.match(/@([\w._-]+)/g) || []),
        ).map((m) => m.slice(1));

        if (mentions.length > 0) {
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
      likesCount: 0,
      isLikedByViewer: false,
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
   * Get paginated comments for a post including likes and reply relations.
   */
  async getPostComments(
    viewerId: string,
    postId: string,
    query: CommentsQueryDto,
  ) {
    await this.postAccessService.validatePostAccess(viewerId, postId);

    const limit = Math.min(query.limit || 50, 100);

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
      isNull(comments.deletedAt),
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

    // Batch query comment likes for the viewer
    const commentIds = pageData.map((c: any) => c.id);
    const viewerLikedCommentIds = new Set<string>();

    if (commentIds.length > 0 && viewerId) {
      const userLikes = await this.db
        .select({ commentId: commentLikes.commentId })
        .from(commentLikes)
        .where(
          and(
            inArray(commentLikes.commentId, commentIds),
            eq(commentLikes.userId, viewerId),
          ),
        );
      userLikes.forEach((l: any) => viewerLikedCommentIds.add(l.commentId));
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
          likesCount: c.likesCount || 0,
          isLikedByViewer: viewerLikedCommentIds.has(c.id),
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
   * Toggle comment like status for the viewer.
   */
  async toggleCommentLike(userId: string, commentId: string) {
    await this.postAccessService.verifyActiveAccount(userId);

    const [comment] = await this.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
      .limit(1);

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const [existingLike] = await this.db
      .select()
      .from(commentLikes)
      .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
      .limit(1);

    let liked = false;
    let newLikesCount = comment.likesCount || 0;

    await this.db.transaction(async (tx: any) => {
      if (existingLike) {
        // Unlike
        await tx
          .delete(commentLikes)
          .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));

        newLikesCount = Math.max(0, newLikesCount - 1);
        await tx
          .update(comments)
          .set({ likesCount: newLikesCount })
          .where(eq(comments.id, commentId));
      } else {
        // Like
        await tx
          .insert(commentLikes)
          .values({ commentId, userId });

        newLikesCount += 1;
        await tx
          .update(comments)
          .set({ likesCount: newLikesCount })
          .where(eq(comments.id, commentId));

        liked = true;

        if (comment.authorId !== userId) {
          await this.outboxService.appendEvent(
            tx,
            `COMMENT_LIKE_${userId}_${commentId}`,
            'POST_LIKE',
            {
              actorId: userId,
              recipientId: comment.authorId,
              entityType: 'COMMENT',
              entityId: commentId,
            },
          );
        }
      }
    });

    return { liked, likesCount: newLikesCount };
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
   * Soft delete comment (Author or Post Owner). Transactionally decrements comments_count.
   */
  async deleteComment(userId: string, commentId: string) {
    await this.postAccessService.verifyActiveAccount(userId);

    const [existing] = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Comment not found');
    }

    const [post] = await this.db
      .select({ authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, existing.postId))
      .limit(1);

    const isCommentAuthor = existing.authorId === userId;
    const isPostAuthor = post?.authorId === userId;

    if (!isCommentAuthor && !isPostAuthor) {
      throw new ForbiddenException(
        'Only the comment author or post creator can delete this comment',
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
