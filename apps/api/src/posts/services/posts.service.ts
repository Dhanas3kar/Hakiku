import { db } from '../../db/index';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, or, sql, desc, lt, inArray } from 'drizzle-orm';
import {
  posts,
  postLikes,
  profiles,
  users,
  blocks,
  connections,
  polls,
} from '../../db/schema';
import * as schema from '../../db/schema';
import { PostAccessService } from './post-access.service';
import { PostMediaService } from './post-media.service';
import {
  CreatePostDto,
  UpdatePostDto,
  UserPostsQueryDto,
} from '../dto/posts.dto';

@Injectable()
export class PostsService {
  private db;

  constructor(
    private readonly postAccessService: PostAccessService,
    private readonly postMediaService: PostMediaService,
  ) {
    this.db = db;
  }

  /**
   * Create a text or multi-media post inside a transaction.
   */
  async createPost(authorId: string, dto: CreatePostDto) {
    await this.postAccessService.verifyActiveAccount(authorId);

    const trimmedContent = dto.content ? dto.content.trim() : '';
    const hasMedia = dto.mediaUploadIds && dto.mediaUploadIds.length > 0;

    if (!trimmedContent && !hasMedia) {
      throw new BadRequestException(
        'A post must contain text content or at least one media attachment',
      );
    }

    let createdPost: any;
    let attachedMedia: any[] = [];

    try {
      await this.db.transaction(async (tx: any) => {
        const [inserted] = await tx
          .insert(posts)
          .values({
            authorId,
            content: trimmedContent || null,
            visibility: dto.visibility || 'PUBLIC',
            idempotencyKey: dto.idempotencyKey,
          })
          .returning();

        createdPost = inserted;

        if (hasMedia) {
          attachedMedia = await this.postMediaService.attachMediaToPost(
            authorId,
            createdPost.id,
            dto.mediaUploadIds!,
            tx,
          );
        }

        if (dto.pollId) {
          const [updatedPoll] = await tx
            .update(polls)
            .set({ postId: createdPost.id })
            .where(and(eq(polls.id, dto.pollId), eq(polls.authorId, authorId)))
            .returning();

          if (!updatedPoll) {
            throw new NotFoundException(
              'Poll not found or not owned by author',
            );
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
                await tx
                  .insert(schema.notificationOutbox)
                  .values({
                    eventId: `POST_MENTION_${createdPost.id}_${profile.userId}`,
                    type: 'MENTION',
                    payload: {
                      actorId: authorId,
                      recipientId: profile.userId,
                      entityType: 'POST',
                      entityId: createdPost.id,
                    },
                  })
                  .onConflictDoNothing({
                    target: [schema.notificationOutbox.eventId],
                  });
              }
            }
          }
        }
      });
    } catch (err: any) {
      const code =
        err?.code ||
        err?.cause?.code ||
        err?.driverError?.code ||
        err?.originalError?.code;
      const constraint =
        err?.constraint ||
        err?.constraint_name ||
        err?.cause?.constraint ||
        err?.cause?.constraint_name ||
        err?.driverError?.constraint ||
        err?.driverError?.constraint_name ||
        '';
      const detail =
        err?.detail ||
        err?.cause?.detail ||
        err?.driverError?.detail ||
        err?.message ||
        err?.cause?.message ||
        '';

      const is23505 =
        code === '23505' ||
        String(err).includes('23505') ||
        String(err?.cause).includes('23505');
      const isIdempotencyConflict =
        is23505 &&
        (constraint.includes('idempotency') ||
          detail.includes('idempotency_key') ||
          detail.includes('idempotency') ||
          String(err).includes('idempotency'));

      if (dto.idempotencyKey && isIdempotencyConflict) {
        let existingPost: any;
        for (let attempt = 0; attempt < 10; attempt++) {
          const [found] = await this.db
            .select()
            .from(posts)
            .where(
              and(
                eq(posts.authorId, authorId),
                eq(posts.idempotencyKey, dto.idempotencyKey),
              ),
            )
            .limit(1);

          if (found) {
            existingPost = found;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 25));
        }

        if (existingPost) {
          createdPost = existingPost;
          attachedMedia = await this.postMediaService.getPostMedia(
            existingPost.id,
          );
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

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
      ...createdPost,
      author: {
        userId: authorId,
        username: authorProfile?.username || 'user',
        displayName: authorProfile?.displayName || 'Student',
        avatarUrl: authorProfile?.avatarKey
          ? `${process.env.BASE_URL || 'http://localhost:3001'}/uploads/${authorProfile.avatarKey}`
          : null,
        isVerifiedIdentity: authorProfile?.isVerifiedIdentity || false,
      },
      media: attachedMedia,
    };
  }

  /**
   * Get single post details with access authorization.
   */
  async getPost(viewerId: string, postId: string) {
    const post = await this.postAccessService.validatePostAccess(
      viewerId,
      postId,
    );

    const [authorProfile] = await this.db
      .select({
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
        isVerifiedIdentity: profiles.isVerifiedIdentity,
      })
      .from(profiles)
      .where(eq(profiles.userId, post.authorId))
      .limit(1);

    const media = await this.postMediaService.getPostMedia(postId);

    const [likeRecord] = await this.db
      .select()
      .from(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, viewerId)))
      .limit(1);

    return {
      ...post,
      author: {
        userId: post.authorId,
        username: authorProfile?.username || 'user',
        displayName: authorProfile?.displayName || 'Student',
        avatarUrl: authorProfile?.avatarKey
          ? `${process.env.BASE_URL || 'http://localhost:3001'}/uploads/${authorProfile.avatarKey}`
          : null,
        isVerifiedIdentity: authorProfile?.isVerifiedIdentity || false,
      },
      media,
      isLikedByViewer: !!likeRecord,
    };
  }

  /**
   * Update post content or visibility (Author only).
   */
  async updatePost(authorId: string, postId: string, dto: UpdatePostDto) {
    await this.postAccessService.verifyActiveAccount(authorId);

    const [existing] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    if (existing.authorId !== authorId) {
      throw new ForbiddenException('Only the post author can update this post');
    }

    const updatedContent =
      dto.content !== undefined ? dto.content.trim() : existing.content;
    const media = await this.postMediaService.getPostMedia(postId);

    if (!updatedContent && media.length === 0) {
      throw new BadRequestException(
        'A post cannot be updated to have no content and no media',
      );
    }

    const [updated] = await this.db
      .update(posts)
      .set({
        content: updatedContent || null,
        visibility:
          dto.visibility !== undefined ? dto.visibility : existing.visibility,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId))
      .returning();

    return this.getPost(authorId, updated.id);
  }

  /**
   * Soft delete post (Author only).
   */
  async deletePost(authorId: string, postId: string) {
    await this.postAccessService.verifyActiveAccount(authorId);

    const [existing] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    if (existing.authorId !== authorId) {
      throw new ForbiddenException('Only the post author can delete this post');
    }

    await this.db
      .update(posts)
      .set({ deletedAt: new Date() })
      .where(eq(posts.id, postId));

    return { message: 'Post deleted successfully', postId };
  }

  /**
   * Admin soft delete post (Bypass Author Ownership).
   */
  async adminSoftDeletePost(
    adminId: string,
    postId: string,
    reason: string,
  ) {
    const [existing] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    await this.db.transaction(async (tx: any) => {
      await tx
        .update(posts)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(posts.id, postId));

      await tx.insert(schema.auditLogs).values({
        userId: adminId,
        event: 'ADMIN_MODERATE_POST',
        metadata: { targetId: postId, reason },
      });
    });

    return { message: 'Post deleted successfully', postId };
  }

  /**
   * Get paginated user posts with visibility and block privacy enforcement.
   */
  async getUserPosts(
    viewerId: string,
    targetUserId: string,
    query: UserPostsQueryDto,
  ) {
    await this.postAccessService.verifyActiveAccount(viewerId);

    // Check target account status
    const [targetUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (
      !targetUser ||
      targetUser.status === 'BANNED' ||
      targetUser.status === 'DEACTIVATED'
    ) {
      throw new NotFoundException('User profile not found');
    }

    // Check Block Privacy
    if (viewerId !== targetUserId) {
      const blockRecord = await this.db
        .select()
        .from(blocks)
        .where(
          or(
            and(
              eq(blocks.blockerId, viewerId),
              eq(blocks.blockedId, targetUserId),
            ),
            and(
              eq(blocks.blockerId, targetUserId),
              eq(blocks.blockedId, viewerId),
            ),
          ),
        )
        .limit(1);

      if (blockRecord.length > 0) {
        throw new NotFoundException('User profile not found');
      }
    }

    const limit = Math.min(query.limit || 20, 50);

    // Determine connection state for visibility filtering
    let isMutualConnection = false;
    if (viewerId !== targetUserId) {
      const userAId = viewerId < targetUserId ? viewerId : targetUserId;
      const userBId = viewerId < targetUserId ? targetUserId : viewerId;
      const conn = await this.db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.userAId, userAId),
            eq(connections.userBId, userBId),
          ),
        )
        .limit(1);
      isMutualConnection = conn.length > 0;
    }

    // Decode Cursor
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

    // Build conditions
    const conditions = [
      eq(posts.authorId, targetUserId),
      sql`${posts.deletedAt} IS NULL`,
    ];

    if (viewerId !== targetUserId) {
      if (isMutualConnection) {
        conditions.push(
          or(
            eq(posts.visibility, 'PUBLIC'),
            eq(posts.visibility, 'CONNECTIONS_ONLY'),
          )!,
        );
      } else {
        conditions.push(eq(posts.visibility, 'PUBLIC'));
      }
    }

    if (cursorCreatedAt && cursorId) {
      conditions.push(
        sql`(${posts.createdAt}, ${posts.id}) < (${cursorCreatedAt.toISOString()}, ${cursorId})`,
      );
    }

    const rows = await this.db
      .select()
      .from(posts)
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt), desc(posts.id))
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

    // Attach author & media info
    const postsWithMeta = await Promise.all(
      pageData.map(async (p: any) => {
        const media = await this.postMediaService.getPostMedia(p.id);
        const [likeRecord] = await this.db
          .select()
          .from(postLikes)
          .where(
            and(eq(postLikes.postId, p.id), eq(postLikes.userId, viewerId)),
          )
          .limit(1);

        return {
          ...p,
          media,
          isLikedByViewer: !!likeRecord,
        };
      }),
    );

    return {
      data: postsWithMeta,
      meta: {
        hasNextPage,
        nextCursor,
        limit,
      },
    };
  }
}
