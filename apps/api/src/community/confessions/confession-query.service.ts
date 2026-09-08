import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { confessions, confessionUpvotes, blocks, users, profiles } from '../../db/schema';
import { eq, and, desc, or, inArray, sql } from 'drizzle-orm';

@Injectable()
export class ConfessionQueryService {
  async getHeroConfession(viewerId?: string, viewerRole?: string) {
    try {
      const activeBlocks = await this.getBlockedUserIds(viewerId);

      const candidates = await db
        .select()
        .from(confessions)
        .where(
          and(
            eq(confessions.status, 'PUBLISHED'),
            sql`COALESCE(${confessions.publishedAt}, ${confessions.createdAt}) >= NOW() - INTERVAL '24 hours'`,
          ),
        )
        .orderBy(desc(sql`COALESCE(${confessions.publishedAt}, ${confessions.createdAt})`));

      let safeHeroes = candidates.filter((c) => !activeBlocks.has(c.authorId));
      let isFallback = false;

      if (safeHeroes.length === 0) {
        const fallback = await db
          .select()
          .from(confessions)
          .where(eq(confessions.status, 'PUBLISHED'))
          .orderBy(desc(sql`COALESCE(${confessions.publishedAt}, ${confessions.createdAt})`))
          .limit(20);
        safeHeroes = fallback.filter((c) => !activeBlocks.has(c.authorId));
        isFallback = true;
      }

      const upvotedSet = await this.getViewerUpvotedConfessionIds(viewerId, safeHeroes.map((c) => c.id));
      const authorMap = await this.getAuthorDetailsIfAdmin(viewerRole, safeHeroes.map((c) => c.authorId));

      return {
        items: safeHeroes.map((c) =>
          this.mapToPublic(c, viewerId, upvotedSet.has(c.id), authorMap.get(c.authorId)),
        ),
        isFallback,
      };
    } catch (err) {
      return {
        items: [],
        isFallback: false,
      };
    }
  }

  async listConfessions(
    viewerId?: string,
    viewerRole?: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    try {
      const activeBlocks = await this.getBlockedUserIds(viewerId);

      const results = await db
        .select()
        .from(confessions)
        .where(
          and(
            eq(confessions.status, 'PUBLISHED'),
            or(
              sql`COALESCE(${confessions.publishedAt}, ${confessions.createdAt}) >= NOW() - INTERVAL '12 hours'`,
              sql`${confessions.upvoteCount} >= 3`
            )
          )
        )
        .orderBy(
          desc(confessions.upvoteCount),
          desc(sql`COALESCE(${confessions.publishedAt}, ${confessions.createdAt})`)
        )
        .limit(100);

      const safeResults = results.filter((c) => !activeBlocks.has(c.authorId));
      const paginated = safeResults.slice(offset, offset + limit);

      const upvotedSet = await this.getViewerUpvotedConfessionIds(viewerId, paginated.map((c) => c.id));
      const authorMap = await this.getAuthorDetailsIfAdmin(viewerRole, paginated.map((c) => c.authorId));

      return paginated.map((c) =>
        this.mapToPublic(c, viewerId, upvotedSet.has(c.id), authorMap.get(c.authorId)),
      );
    } catch (err) {
      return [];
    }
  }

  private async getViewerUpvotedConfessionIds(viewerId?: string, confessionIds: string[] = []): Promise<Set<string>> {
    if (!viewerId || confessionIds.length === 0) return new Set();

    try {
      const records = await db
        .select({ confessionId: confessionUpvotes.confessionId })
        .from(confessionUpvotes)
        .where(
          and(
            eq(confessionUpvotes.userId, viewerId),
            inArray(confessionUpvotes.confessionId, confessionIds),
          ),
        );

      return new Set(records.map((r) => r.confessionId));
    } catch (e) {
      return new Set();
    }
  }

  private async getAuthorDetailsIfAdmin(viewerRole?: string, authorIds: string[] = []): Promise<Map<string, string>> {
    const isAdmin = viewerRole === 'ADMIN' || viewerRole === 'MODERATOR';
    if (!isAdmin || authorIds.length === 0) return new Map();

    try {
      const uniqueAuthorIds = Array.from(new Set(authorIds));
      const authorUsers = await db
        .select()
        .from(users)
        .where(inArray(users.id, uniqueAuthorIds));

      const authorProfiles = await db
        .select()
        .from(profiles)
        .where(inArray(profiles.userId, uniqueAuthorIds));

      const profileMap = new Map(authorProfiles.map((p) => [p.userId, p]));
      const map = new Map<string, string>();

      for (const u of authorUsers) {
        const prof = profileMap.get(u.id);
        const name = prof?.displayName || prof?.username || 'user';
        const handle = prof?.username ? `@${prof.username}` : u.email;
        map.set(u.id, `${name} (${handle}) [ADMIN VIEW]`);
      }

      return map;
    } catch (e) {
      return new Map();
    }
  }

  private async getBlockedUserIds(userId?: string): Promise<Set<string>> {
    if (!userId) return new Set<string>();
    try {
      const blockRecords = await db
        .select()
        .from(blocks)
        .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));

      const blockedIds = new Set<string>();
      for (const b of blockRecords) {
        blockedIds.add(b.blockerId === userId ? b.blockedId : b.blockerId);
      }
      return blockedIds;
    } catch (e) {
      return new Set();
    }
  }

  private mapToPublic(confession: any, viewerId?: string, isUpvoted: boolean = false, adminAuthorInfo?: string) {
    const mentionMatch = confession.content ? confession.content.match(/@([a-zA-Z0-9_.]+)/) : null;
    const targetHandle = mentionMatch ? mentionMatch[1] : null;

    return {
      id: confession.id,
      content: confession.content || '',
      campus: confession.campus || null,
      publishedAt: confession.publishedAt || confession.createdAt,
      createdAt: confession.createdAt,
      expiresAt: confession.expiresAt,
      isAuthor: Boolean(viewerId && confession.authorId === viewerId),
      upvoteCount: confession.upvoteCount || 0,
      isUpvoted,
      authorName: adminAuthorInfo || 'anonymous',
      targetHandle,
    };
  }
}

