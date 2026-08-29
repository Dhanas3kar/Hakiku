import { db } from '../../db/index';
import { Injectable } from '@nestjs/common';
import { eq, and, or, inArray } from 'drizzle-orm';
import {
  posts,
  profiles,
  postMedia,
  postLikes,
  follows,
  connections,
  profileSkills,
  profileInterests,
  polls,
  pollOptions,
} from '../../db/schema';
import * as schema from '../../db/schema';
import { FeedItemContext, ViewerContext } from './feed-ranking.service';

@Injectable()
export class FeedQueryService {
  private db;

  constructor() {
    this.db = db;
  }

  /**
   * Get Viewer Context (profile fields, skills, interests) for ranking.
   */
  async getViewerContext(viewerId: string): Promise<ViewerContext> {
    const [prof] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, viewerId))
      .limit(1);

    if (!prof) {
      return { userId: viewerId };
    }

    const pSkills = await this.db
      .select({ skillId: profileSkills.skillId })
      .from(profileSkills)
      .where(eq(profileSkills.profileId, prof.id));

    const pInterests = await this.db
      .select({ interestId: profileInterests.interestId })
      .from(profileInterests)
      .where(eq(profileInterests.profileId, prof.id));

    return {
      userId: viewerId,
      campus: prof.campus,
      department: prof.department,
      batchYear: prof.batchYear,
      skillIds: pSkills.map((ps: any) => ps.skillId),
      interestIds: pInterests.map((pi: any) => pi.interestId),
    };
  }

  /**
   * Batch-hydrate candidate posts and author relationship state without N+1 queries.
   */
  async hydrateCandidatePosts(
    viewerId: string,
    candidatePostIds: string[],
  ): Promise<FeedItemContext[]> {
    if (!candidatePostIds || candidatePostIds.length === 0) return [];

    // 1. Fetch Posts Records
    const postRows = await this.db
      .select()
      .from(posts)
      .where(inArray(posts.id, candidatePostIds));
    if (postRows.length === 0) return [];

    const authorIds = Array.from(new Set(postRows.map((p: any) => p.authorId)));
    const postIds = postRows.map((p: any) => p.id);

    const nonSelfAuthorIds = authorIds.filter((id) => id !== viewerId);

    // 2. Execute Parallel Batch Detail Queries (O(1) roundtrips)
    const [profilesRows, mediaRows, likesRows, followsRows, connRows, pollsRows] =
      await Promise.all([
        // Author Profiles
        this.db
          .select()
          .from(profiles)
          .where(inArray(profiles.userId, authorIds)),
        // Post Media
        this.db
          .select()
          .from(postMedia)
          .where(inArray(postMedia.postId, postIds))
          .orderBy(postMedia.displayOrder),
        // Viewer Likes State
        this.db
          .select({ postId: postLikes.postId })
          .from(postLikes)
          .where(
            and(
              eq(postLikes.userId, viewerId),
              inArray(postLikes.postId, postIds),
            ),
          ),
        // Viewer Follows State
        nonSelfAuthorIds.length > 0
          ? this.db
              .select({ followingId: follows.followingId })
              .from(follows)
              .where(
                and(
                  eq(follows.followerId, viewerId),
                  inArray(follows.followingId, nonSelfAuthorIds),
                ),
              )
          : Promise.resolve([]),
        // Viewer Connections State
        nonSelfAuthorIds.length > 0
          ? this.db
              .select()
              .from(connections)
              .where(
                or(
                  ...nonSelfAuthorIds.map((aId) => {
                    const uA = viewerId < aId ? viewerId : aId;
                    const uB = viewerId < aId ? aId : viewerId;
                    return and(
                      eq(connections.userAId, uA),
                      eq(connections.userBId, uB),
                    );
                  }),
                ),
              )
          : Promise.resolve([]),
        // Associated Polls
        this.db
          .select()
          .from(polls)
          .where(inArray(polls.postId, postIds)),
      ]);

    // Fetch Poll Options for the polls we found
    let pollOptsRows: any[] = [];
    if (pollsRows.length > 0) {
      pollOptsRows = await this.db
        .select()
        .from(pollOptions)
        .where(inArray(pollOptions.pollId, pollsRows.map((p: any) => p.id)));
    }

    // Build Lookup Maps
    const profileMap = new Map<string, any>();
    profilesRows.forEach((pr: any) => profileMap.set(pr.userId, pr));

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

    const likedPostIds = new Set(likesRows.map((l: any) => l.postId));
    const followedUserIds = new Set(followsRows.map((f: any) => f.followingId));
    const connectedUserIds = new Set<string>();

    connRows.forEach((c: any) => {
      const otherId = c.userAId === viewerId ? c.userBId : c.userAId;
      connectedUserIds.add(otherId);
    });

    const pollMap = new Map<string, any>();
    pollsRows.forEach((p: any) => {
      pollMap.set(p.postId, {
        ...p,
        options: pollOptsRows.filter((opt: any) => opt.pollId === p.id),
      });
    });

    // Assemble Hydrated Feed Contexts
    return postRows.map((p: any) => {
      const authorProf = profileMap.get(p.authorId);
      return {
        post: {
          id: p.id,
          content: p.content,
          visibility: p.visibility,
          likesCount: p.likesCount,
          commentsCount: p.commentsCount,
          createdAt: p.createdAt,
          deletedAt: p.deletedAt,
          authorId: p.authorId,
          media: mediaMap.get(p.id) || [],
          poll: pollMap.get(p.id) || null,
        },
        author: {
          userId: p.authorId,
          username: authorProf?.username || 'user',
          displayName: authorProf?.displayName || 'Student',
          avatarUrl: authorProf?.avatarKey
            ? `${baseUrl}/uploads/${authorProf.avatarKey}`
            : null,
          campus: authorProf?.campus,
          department: authorProf?.department,
          batchYear: authorProf?.batchYear,
          isVerifiedIdentity: authorProf?.isVerifiedIdentity || false,
        },
        viewerState: {
          isLiked: likedPostIds.has(p.id),
          isFollowing: followedUserIds.has(p.authorId),
          isConnected: connectedUserIds.has(p.authorId),
        },
      };
    });
  }
}
