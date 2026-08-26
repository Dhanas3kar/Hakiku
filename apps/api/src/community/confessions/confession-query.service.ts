import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { confessions, blocks } from '../../db/schema';
import { eq, and, desc, gt, or } from 'drizzle-orm';

@Injectable()
export class ConfessionQueryService {
  async getHeroConfession(viewerId: string) {
    const activeBlocks = await this.getBlockedUserIds(viewerId);

    // We fetch the most recently published confession within the last 24h
    // In a real scenario, this might be explicitly flagged, but we use freshness here
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let candidates = await db.query.confessions.findMany({
      where: and(
        eq(confessions.status, 'PUBLISHED'),
        gt(confessions.publishedAt, twentyFourHoursAgo),
      ),
      orderBy: [desc(confessions.publishedAt)],
      limit: 20, // Fetch a batch to filter out blocked users
    });

    let isFallback = false;

    // Fallback: if no 24h confessions, just fetch the latest published
    if (candidates.length === 0) {
      candidates = await db.query.confessions.findMany({
        where: eq(confessions.status, 'PUBLISHED'),
        orderBy: [desc(confessions.publishedAt)],
        limit: 20,
      });
      isFallback = true;
    }

    const safeHeroes = candidates.filter((c) => !activeBlocks.has(c.authorId)).slice(0, 3);

    return {
      items: safeHeroes.map(c => this.mapToPublic(c, viewerId)),
      isFallback
    };
  }

  async listConfessions(
    viewerId: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    const activeBlocks = await this.getBlockedUserIds(viewerId);

    const results = await db.query.confessions.findMany({
      where: eq(confessions.status, 'PUBLISHED'),
      orderBy: [desc(confessions.publishedAt)],
      limit: 100, // Fetch up to 100, then filter locally and apply pagination
    });

    // Filter out blocked users
    const safeResults = results.filter((c) => !activeBlocks.has(c.authorId));

    // Simple offset pagination since confessions aren't as infinite as feed
    const paginated = safeResults.slice(offset, offset + limit);

    return paginated.map((c) => this.mapToPublic(c, viewerId));
  }

  private async getBlockedUserIds(userId: string): Promise<Set<string>> {
    const blockRecords = await db.query.blocks.findMany({
      where: or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)),
    });

    const blockedIds = new Set<string>();
    for (const b of blockRecords) {
      blockedIds.add(b.blockerId === userId ? b.blockedId : b.blockerId);
    }
    return blockedIds;
  }

  private mapToPublic(confession: any, viewerId: string) {
    return {
      id: confession.id,
      content: confession.content,
      campus: confession.campus,
      publishedAt: confession.publishedAt,
      isAuthor: confession.authorId === viewerId,
    };
  }
}
