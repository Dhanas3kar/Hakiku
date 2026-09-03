import { db } from '../../db/index';
import { Injectable } from '@nestjs/common';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import {
  postMedia,
  postLikes,
  polls,
  pollOptions,
} from '../../db/schema';
import { FeedItemContext, ViewerContext } from './feed-ranking.service';

/** Helper: build a parameterized IN clause for raw sql`` usage */
function sqlInList(ids: string[]) {
  if (ids.length === 0) return sql`(NULL)`;
  return sql`(${sql.join(ids.map(id => sql`${id}`), sql`, `)})`;
}

/**
 * Phase 4 consolidated feed query service.
 * Replaces ~10 hydration/context queries with ~5 highly optimized queries.
 */
@Injectable()
export class FeedQueryService {
  private db;

  constructor() {
    this.db = db;
  }

  /**
   * Consolidated Viewer Context: profile + skills + interests in a single query
   * using correlated subqueries for JSON aggregation.
   * Replaces 3 sequential/concurrent queries with 1.
   */
  async getViewerContext(viewerId: string): Promise<ViewerContext> {
    const rows = await this.db.execute(sql`
      SELECT
        p.id as profile_id,
        p.campus,
        p.department,
        p.batch_year,
        COALESCE(
          (SELECT json_agg(ps.skill_id) FROM profile_skills ps WHERE ps.profile_id = p.id),
          '[]'::json
        ) AS skill_ids,
        COALESCE(
          (SELECT json_agg(pi.interest_id) FROM profile_interests pi WHERE pi.profile_id = p.id),
          '[]'::json
        ) AS interest_ids
      FROM profiles p
      WHERE p.user_id = ${viewerId}
      LIMIT 1
    `);

    const row = (rows as any[])[0];
    if (!row) {
      return { userId: viewerId };
    }

    return {
      userId: viewerId,
      campus: row.campus,
      department: row.department,
      batchYear: row.batch_year,
      skillIds: Array.isArray(row.skill_ids) ? row.skill_ids.filter((s: any) => s !== null) : [],
      interestIds: Array.isArray(row.interest_ids) ? row.interest_ids.filter((s: any) => s !== null) : [],
    };
  }

  /**
   * Consolidated Hydration: Posts + Author Profiles + User Account Status in one JOIN,
   * plus a Unified Relationship Matrix, viewer likes, media, and polls.
   *
   * Replaces ~10 queries with 5 concurrent queries:
   *   Query C: Posts + Authors + Account Status (1 JOIN)
   *   Query D: Unified Relationship Matrix (follows + connections + blocks bounded to author IDs)
   *   Query E: Viewer Likes
   *   Query F: Post Media
   *   Query G: Polls + Poll Options
   *
   * Visibility and block filtering are performed inline during assembly
   * to eliminate the separate FeedVisibilityService pass.
   */
  async hydrateCandidatePosts(
    viewerId: string,
    candidatePostIds: string[],
  ): Promise<FeedItemContext[]> {
    if (!candidatePostIds || candidatePostIds.length === 0) return [];

    const postIdsSql = sqlInList(candidatePostIds);

    // ── Query C: Posts + Authors + Account Status ──
    const postsAuthorsPromise = this.db.execute(sql`
      SELECT
        p.id, p.content, p.visibility, p.likes_count, p.comments_count,
        p.created_at, p.deleted_at, p.author_id,
        prof.user_id as prof_user_id, prof.username, prof.display_name,
        prof.avatar_key, prof.campus as author_campus,
        prof.department as author_department, prof.batch_year as author_batch_year,
        prof.is_verified_identity,
        u.status as author_status
      FROM posts p
      INNER JOIN users u ON p.author_id = u.id
      LEFT JOIN profiles prof ON u.id = prof.user_id
      WHERE p.id IN ${postIdsSql}
    `);

    // ── Query D: Unified Relationship Matrix ──
    // Bounded strictly to candidate post authors, NOT the viewer's entire graph.
    // Uses a subquery to extract author IDs from the candidate posts.
    const authorSubquery = sql`(SELECT DISTINCT p.author_id FROM posts p WHERE p.id IN ${postIdsSql})`;

    const relationshipMatrixPromise = this.db.execute(sql`
      SELECT target_id,
             bool_or(is_following) AS is_following,
             bool_or(is_connected) AS is_connected,
             bool_or(is_blocked) AS is_blocked
      FROM (
        SELECT f.following_id AS target_id,
               TRUE AS is_following, FALSE AS is_connected, FALSE AS is_blocked
        FROM follows f
        WHERE f.follower_id = ${viewerId}
          AND f.following_id IN ${authorSubquery}

        UNION ALL

        SELECT CASE
                 WHEN c.user_a_id = ${viewerId} THEN c.user_b_id
                 ELSE c.user_a_id
               END AS target_id,
               FALSE AS is_following, TRUE AS is_connected, FALSE AS is_blocked
        FROM connections c
        WHERE (c.user_a_id = ${viewerId} OR c.user_b_id = ${viewerId})
          AND (
            CASE
              WHEN c.user_a_id = ${viewerId} THEN c.user_b_id
              ELSE c.user_a_id
            END
          ) IN ${authorSubquery}

        UNION ALL

        SELECT CASE
                 WHEN b.blocker_id = ${viewerId} THEN b.blocked_id
                 ELSE b.blocker_id
               END AS target_id,
               FALSE AS is_following, FALSE AS is_connected, TRUE AS is_blocked
        FROM blocks b
        WHERE (b.blocker_id = ${viewerId} OR b.blocked_id = ${viewerId})
          AND (
            CASE
              WHEN b.blocker_id = ${viewerId} THEN b.blocked_id
              ELSE b.blocker_id
            END
          ) IN ${authorSubquery}
      ) AS relations
      GROUP BY target_id
    `);

    // ── Query E: Viewer Likes (bounded to candidate post IDs) ──
    const likesPromise = this.db
      .select({ postId: postLikes.postId })
      .from(postLikes)
      .where(
        and(
          eq(postLikes.userId, viewerId),
          inArray(postLikes.postId, candidatePostIds),
        ),
      );

    // ── Query F: Post Media (bounded to candidate post IDs) ──
    const mediaPromise = this.db
      .select()
      .from(postMedia)
      .where(inArray(postMedia.postId, candidatePostIds))
      .orderBy(postMedia.displayOrder);

    // ── Query G: Polls (bounded to candidate post IDs) ──
    const pollsPromise = this.db
      .select()
      .from(polls)
      .where(inArray(polls.postId, candidatePostIds));

    // Execute all 5 queries concurrently
    const [postsAuthorsRows, relationshipRows, likesRows, mediaRows, pollsRows] =
      await Promise.all([
        postsAuthorsPromise,
        relationshipMatrixPromise,
        likesPromise,
        mediaPromise,
        pollsPromise,
      ]);

    // Fetch Poll Options if we have polls (conditional 6th query)
    let pollOptsRows: any[] = [];
    if ((pollsRows as any[]).length > 0) {
      pollOptsRows = await this.db
        .select()
        .from(pollOptions)
        .where(inArray(pollOptions.pollId, (pollsRows as any[]).map((p: any) => p.id)));
    }

    // ── Build Lookup Maps ──

    // Relationship Matrix Map
    const relationMap = new Map<string, { isFollowing: boolean; isConnected: boolean; isBlocked: boolean }>();
    (relationshipRows as any[]).forEach((r: any) => {
      relationMap.set(r.target_id, {
        isFollowing: r.is_following === true,
        isConnected: r.is_connected === true,
        isBlocked: r.is_blocked === true,
      });
    });

    // Viewer Likes Set
    const likedPostIds = new Set(likesRows.map((l: any) => l.postId));

    // Media Map
    const mediaMap = new Map<string, any[]>();
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    mediaRows.forEach((m: any) => {
      const list = mediaMap.get(m.postId) || [];
      list.push({
        ...m,
        url: `${baseUrl}/uploads/${m.storageKey}`,
      });
      mediaMap.set(m.postId, list);
    });

    // Poll Map
    const pollMap = new Map<string, any>();
    (pollsRows as any[]).forEach((p: any) => {
      pollMap.set(p.postId, {
        ...p,
        options: pollOptsRows.filter((opt: any) => opt.pollId === p.id),
      });
    });

    // ── Assemble Hydrated Feed Contexts ──
    // Inline visibility and block filtering to avoid a separate pass
    const results: FeedItemContext[] = [];

    for (const p of postsAuthorsRows as any[]) {
      // Skip inactive authors (SUSPENDED, BANNED, DEACTIVATED)
      if (p.author_status !== 'ACTIVE') continue;

      // Skip soft-deleted posts
      if (p.deleted_at) continue;

      const isOwnPost = p.author_id === viewerId;
      const authorRelation = relationMap.get(p.author_id);

      // Skip blocked authors (viewer blocked them OR they blocked viewer)
      if (!isOwnPost && authorRelation?.isBlocked) continue;

      // Visibility filtering
      if (!isOwnPost) {
        if (p.visibility === 'PRIVATE') continue;
        if (p.visibility === 'CONNECTIONS_ONLY' && !authorRelation?.isConnected) continue;
      }

      results.push({
        post: {
          id: p.id,
          content: p.content,
          visibility: p.visibility,
          likesCount: p.likes_count,
          commentsCount: p.comments_count,
          createdAt: p.created_at,
          authorId: p.author_id,
          media: mediaMap.get(p.id) || [],
          poll: pollMap.get(p.id) || null,
        } as any,
        author: {
          userId: p.author_id,
          username: p.username || 'user',
          displayName: p.display_name || 'Student',
          avatarUrl: p.avatar_key
            ? `${baseUrl}/uploads/${p.avatar_key}`
            : null,
          campus: p.author_campus,
          department: p.author_department,
          batchYear: p.author_batch_year,
          isVerifiedIdentity: p.is_verified_identity || false,
        } as any,
        viewerState: {
          isLiked: likedPostIds.has(p.id),
          isFollowing: authorRelation?.isFollowing || false,
          isConnected: authorRelation?.isConnected || false,
        },
      });
    }

    return results;
  }
}
