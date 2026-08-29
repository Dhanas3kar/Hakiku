import { db } from '../../db/index';
import { Injectable } from '@nestjs/common';
import { eq, and, or, inArray, sql, desc } from 'drizzle-orm';
import * as schema from '../../db/schema';
import {
  posts,
  follows,
  connections,
  profiles,
  profileSkills,
  profileInterests,
  skills,
  interests,
} from '../../db/schema';
import { DiscoverQueryDto } from '../dto/feed.dto';

@Injectable()
export class FeedCandidateService {
  private db;

  constructor() {
    this.db = db;
  }

  /**
   * Fetch candidate post IDs from multiple bounded candidate buckets for personalized feed.
   */
  async getPersonalizedCandidates(viewerId: string): Promise<string[]> {
    const candidatePostIds = new Set<string>();

    // 1. Followed Users' Posts
    const followList = await this.db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, viewerId));
    const followedIds = followList.map((f: any) => f.followingId);

    if (followedIds.length > 0) {
      const followedPosts = await this.db
        .select({ id: posts.id })
        .from(posts)
        .where(
          and(
            inArray(posts.authorId, followedIds),
            sql`${posts.deletedAt} IS NULL`,
          ),
        )
        .orderBy(desc(posts.createdAt))
        .limit(100);
      followedPosts.forEach((p: any) => candidatePostIds.add(p.id));
    }

    // 2. Connected Users' Posts
    const connList = await this.db
      .select()
      .from(connections)
      .where(
        or(
          eq(connections.userAId, viewerId),
          eq(connections.userBId, viewerId),
        ),
      );
    const connectedIds = connList.map((c: any) =>
      c.userAId === viewerId ? c.userBId : c.userAId,
    );

    if (connectedIds.length > 0) {
      const connectedPosts = await this.db
        .select({ id: posts.id })
        .from(posts)
        .where(
          and(
            inArray(posts.authorId, connectedIds),
            sql`${posts.deletedAt} IS NULL`,
          ),
        )
        .orderBy(desc(posts.createdAt))
        .limit(100);
      connectedPosts.forEach((p: any) => candidatePostIds.add(p.id));
    }

    // 3. Own Posts
    const ownPosts = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.authorId, viewerId), sql`${posts.deletedAt} IS NULL`))
      .orderBy(desc(posts.createdAt))
      .limit(50);
    ownPosts.forEach((p: any) => candidatePostIds.add(p.id));

    // 4. Viewer Academic Context Relevance
    const [viewerProfile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, viewerId))
      .limit(1);

    if (viewerProfile) {
      const academicProfiles = await this.db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(
          and(
            or(
              eq(profiles.campus, viewerProfile.campus),
              eq(profiles.department, viewerProfile.department),
              eq(profiles.batchYear, viewerProfile.batchYear),
            ),
            sql`${profiles.userId} <> ${viewerId}`,
          ),
        )
        .limit(100);

      const academicUserIds = academicProfiles.map((ap: any) => ap.userId);
      if (academicUserIds.length > 0) {
        const academicPosts = await this.db
          .select({ id: posts.id })
          .from(posts)
          .where(
            and(
              inArray(posts.authorId, academicUserIds),
              eq(posts.visibility, 'PUBLIC'),
              sql`${posts.deletedAt} IS NULL`,
            ),
          )
          .orderBy(desc(posts.createdAt))
          .limit(100);
        academicPosts.forEach((p: any) => candidatePostIds.add(p.id));
      }
    }

    // 5. General Public Posts Bucket
    const publicPosts = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(eq(posts.visibility, 'PUBLIC'), sql`${posts.deletedAt} IS NULL`),
      )
      .orderBy(desc(posts.createdAt))
      .limit(100);
    publicPosts.forEach((p: any) => candidatePostIds.add(p.id));

    return Array.from(candidatePostIds);
  }

  /**
   * Fetch candidate post IDs for public discovery feed with optional academic & taxonomy filters.
   */
  async getDiscoveryCandidates(
    viewerId: string,
    filters: DiscoverQueryDto,
  ): Promise<string[]> {
    let authorIdFilter: string[] | null = null;

    if (filters.campus || filters.department || filters.batch) {
      const profileConditions = [];
      if (filters.campus)
        profileConditions.push(eq(profiles.campus, filters.campus));
      if (filters.department)
        profileConditions.push(eq(profiles.department, filters.department));
      if (filters.batch)
        profileConditions.push(eq(profiles.batchYear, filters.batch));

      const matchedProfiles = await this.db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(and(...profileConditions))
        .limit(200);

      authorIdFilter = matchedProfiles.map((p: any) => p.userId);
      if (authorIdFilter.length === 0) return [];
    }

    const postConditions = [
      eq(posts.visibility, 'PUBLIC'),
      sql`${posts.deletedAt} IS NULL`,
    ];

    if (authorIdFilter) {
      postConditions.push(inArray(posts.authorId, authorIdFilter));
    }

    const candidatePosts = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(and(...postConditions))
      .orderBy(desc(posts.createdAt))
      .limit(200);

    return candidatePosts.map((p: any) => p.id);
  }
}
