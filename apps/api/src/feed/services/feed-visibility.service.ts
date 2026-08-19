import { db } from '../../db/index';
import { Injectable } from '@nestjs/common';
import { eq, and, or, inArray } from 'drizzle-orm';
import { blocks, users, connections } from '../../db/schema';
import * as schema from '../../db/schema';

@Injectable()
export class FeedVisibilityService {
  private db;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  /**
   * Batch filter a list of post items based on block isolation, account security status, and visibility rules.
   */
  async filterVisiblePosts(viewerId: string, posts: any[]): Promise<any[]> {
    if (!posts || posts.length === 0) return [];

    // 1. Exclude soft-deleted posts
    const activePosts = posts.filter((p) => !p.deletedAt);
    if (activePosts.length === 0) return [];

    const authorIds = Array.from(new Set(activePosts.map((p) => p.authorId)));

    // 2. Fetch Author Users to check account status (SUSPENDED / BANNED / DEACTIVATED)
    const authorUsers = await this.db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(inArray(users.id, authorIds));

    const activeAuthorIds = new Set(
      authorUsers
        .filter((u: any) => u.status === 'ACTIVE')
        .map((u: any) => u.id),
    );

    const validStatusPosts = activePosts.filter((p) =>
      activeAuthorIds.has(p.authorId),
    );
    if (validStatusPosts.length === 0) return [];

    // 3. Fetch Blocked Author IDs involving viewer
    const blockRecords = await this.db
      .select()
      .from(blocks)
      .where(
        or(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, viewerId)),
      );

    const blockedUserIds = new Set<string>();
    for (const b of blockRecords) {
      if (b.blockerId === viewerId) blockedUserIds.add(b.blockedId);
      if (b.blockedId === viewerId) blockedUserIds.add(b.blockerId);
    }

    const unblockedPosts = validStatusPosts.filter(
      (p) => p.authorId === viewerId || !blockedUserIds.has(p.authorId),
    );
    if (unblockedPosts.length === 0) return [];

    // 4. Fetch Mutual Connections between viewer and non-self authors
    const nonSelfAuthorIds = Array.from(
      new Set(
        unblockedPosts
          .filter((p) => p.authorId !== viewerId)
          .map((p) => p.authorId),
      ),
    );

    const connectedAuthorIds = new Set<string>();
    if (nonSelfAuthorIds.length > 0) {
      const connRecords = await this.db
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
        );

      for (const c of connRecords) {
        const otherId = c.userAId === viewerId ? c.userBId : c.userAId;
        connectedAuthorIds.add(otherId);
      }
    }

    // 5. Apply Visibility Rules
    return unblockedPosts.filter((p) => {
      if (p.authorId === viewerId) return true; // Author sees all own posts

      if (p.visibility === 'PUBLIC') return true;

      if (p.visibility === 'CONNECTIONS_ONLY') {
        return connectedAuthorIds.has(p.authorId);
      }

      if (p.visibility === 'PRIVATE') return false;

      return false;
    });
  }
}
