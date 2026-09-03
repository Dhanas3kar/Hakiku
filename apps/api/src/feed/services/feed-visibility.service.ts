import { db } from '../../db/index';
import { Injectable } from '@nestjs/common';
import { eq, and, or, inArray } from 'drizzle-orm';
import { blocks, users, connections } from '../../db/schema';
import * as schema from '../../db/schema';

@Injectable()
export class FeedVisibilityService {
  private db;

  constructor() {
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
    const nonSelfAuthorIds = authorIds.filter((id) => id !== viewerId);

    // 2. Fetch Author Users, Block Records, and Mutual Connections Concurrently
    const [authorUsers, blockRecords, connRecords] = await Promise.all([
      // Author Status
      this.db
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(inArray(users.id, authorIds)),

      // Blocked Users
      this.db
        .select()
        .from(blocks)
        .where(
          or(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, viewerId)),
        ),

      // Mutual Connections restricted to candidate authors
      nonSelfAuthorIds.length > 0
        ? this.db
            .select()
            .from(connections)
            .where(
              or(
                and(
                  eq(connections.userAId, viewerId),
                  inArray(connections.userBId, nonSelfAuthorIds),
                ),
                and(
                  eq(connections.userBId, viewerId),
                  inArray(connections.userAId, nonSelfAuthorIds),
                ),
              ),
            )
        : Promise.resolve([]),
    ]);

    // Active Authors Set
    const activeAuthorIds = new Set(
      authorUsers
        .filter((u: any) => u.status === 'ACTIVE')
        .map((u: any) => u.id),
    );

    const validStatusPosts = activePosts.filter((p) =>
      activeAuthorIds.has(p.authorId),
    );
    if (validStatusPosts.length === 0) return [];

    // Blocked Authors Set
    const blockedUserIds = new Set<string>();
    for (const b of blockRecords) {
      if (b.blockerId === viewerId) blockedUserIds.add(b.blockedId);
      if (b.blockedId === viewerId) blockedUserIds.add(b.blockerId);
    }

    const unblockedPosts = validStatusPosts.filter(
      (p) => p.authorId === viewerId || !blockedUserIds.has(p.authorId),
    );
    if (unblockedPosts.length === 0) return [];

    // Connected Authors Set
    const connectedAuthorIds = new Set<string>();
    for (const c of connRecords) {
      const otherId = c.userAId === viewerId ? c.userBId : c.userAId;
      connectedAuthorIds.add(otherId);
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
