import { db } from '../../db/index';
import { Injectable } from '@nestjs/common';
import { eq, and, or, inArray, sql, desc } from 'drizzle-orm';
import {
  posts,
  follows,
  connections,
  profiles,
} from '../../db/schema';
import { DiscoverQueryDto } from '../dto/feed.dto';

/**
 * Phase 4 consolidated candidate generation.
 * Replaces 9 separate queries with a single UNION ALL query pushed to PostgreSQL.
 */
@Injectable()
export class FeedCandidateService {
  private db;

  constructor() {
    this.db = db;
  }

  /**
   * Fetch candidate post IDs from multiple bounded candidate buckets using a single
   * UNION ALL query. Each bucket preserves its original bounded LIMIT.
   *
   * Buckets:
   *   1. Own posts (LIMIT 50)
   *   2. Followed users' posts (LIMIT 100)
   *   3. Connected users' posts (LIMIT 100)
   *   4. Academic context peers' PUBLIC posts (LIMIT 100)
   *   5. General public posts (LIMIT 100)
   */
  async getPersonalizedCandidates(
    viewerId: string,
    viewerProfile?: { campus?: string; department?: string; batchYear?: number },
  ): Promise<string[]> {
    // Build the academic OR conditions dynamically
    const academicOrParts: ReturnType<typeof sql>[] = [];
    if (viewerProfile?.campus) {
      academicOrParts.push(sql`ap.campus = ${viewerProfile.campus}`);
    }
    if (viewerProfile?.department) {
      academicOrParts.push(sql`ap.department = ${viewerProfile.department}`);
    }
    if (viewerProfile?.batchYear) {
      academicOrParts.push(sql`ap.batch_year = ${viewerProfile.batchYear}`);
    }

    // If no academic context, use FALSE to skip that bucket entirely
    const academicFilter = academicOrParts.length > 0
      ? sql.join(academicOrParts, sql` OR `)
      : sql`FALSE`;

    const result = await this.db.execute(sql`
      SELECT DISTINCT id FROM (
        (SELECT p.id FROM posts p
         WHERE p.author_id = ${viewerId}
         AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC LIMIT 50)

        UNION ALL

        (SELECT p.id FROM posts p
         INNER JOIN follows f ON p.author_id = f.following_id
         WHERE f.follower_id = ${viewerId}
         AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC LIMIT 100)

        UNION ALL

        (SELECT p.id FROM posts p
         INNER JOIN connections c ON
           (c.user_a_id = ${viewerId} AND p.author_id = c.user_b_id)
           OR (c.user_b_id = ${viewerId} AND p.author_id = c.user_a_id)
         WHERE p.deleted_at IS NULL
         ORDER BY p.created_at DESC LIMIT 100)

        UNION ALL

        (SELECT p.id FROM posts p
         INNER JOIN profiles ap ON p.author_id = ap.user_id
         WHERE ap.user_id <> ${viewerId}
         AND (${academicFilter})
         AND p.visibility = 'PUBLIC'
         AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC LIMIT 100)

        UNION ALL

        (SELECT p.id FROM posts p
         WHERE p.visibility = 'PUBLIC'
         AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC LIMIT 100)
      ) AS candidates
    `);

    return (result as any[]).map((r: any) => r.id);
  }

  /**
   * Fetch candidate post IDs for public discovery feed with optional academic & taxonomy filters.
   * This is already efficient (1-2 queries), kept with minor consolidation.
   */
  async getDiscoveryCandidates(
    viewerId: string,
    filters: DiscoverQueryDto,
  ): Promise<string[]> {
    if (filters.campus || filters.department || filters.batch) {
      const profileConditions: ReturnType<typeof sql>[] = [];
      if (filters.campus) {
        profileConditions.push(sql`ap.campus = ${filters.campus}`);
      }
      if (filters.department) {
        profileConditions.push(sql`ap.department = ${filters.department}`);
      }
      if (filters.batch) {
        profileConditions.push(sql`ap.batch_year = ${filters.batch}`);
      }

      const profileFilter = sql.join(profileConditions, sql` AND `);

      const result = await this.db.execute(sql`
        SELECT p.id FROM posts p
        INNER JOIN profiles ap ON p.author_id = ap.user_id
        WHERE p.visibility = 'PUBLIC'
        AND p.deleted_at IS NULL
        AND (${profileFilter})
        ORDER BY p.created_at DESC LIMIT 200
      `);
      return (result as any[]).map((r: any) => r.id);
    }

    const result = await this.db.execute(sql`
      SELECT p.id FROM posts p
      WHERE p.visibility = 'PUBLIC'
      AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC LIMIT 200
    `);
    return (result as any[]).map((r: any) => r.id);
  }
}
