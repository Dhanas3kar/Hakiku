import { Injectable, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { db } from '../../db/index';
import { hotTakes, hotTakeVotes, profiles, notificationOutbox } from '../../db/schema';
import { desc, eq, inArray, and, sql } from 'drizzle-orm';

@Injectable()
export class HotTakesService implements OnModuleInit {
  private db = db;

  private voteTableEnsured = false;

  async onModuleInit() {
    await this.ensureVoteTable();
  }

  private async ensureVoteTable() {
    if (this.voteTableEnsured) return;
    try {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS hot_take_votes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hot_take_id UUID NOT NULL REFERENCES hot_takes(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          vote_type TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          CONSTRAINT idx_unique_user_hot_take_vote UNIQUE (hot_take_id, user_id)
        );
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_hot_take_votes_take_id ON hot_take_votes(hot_take_id);
      `);
      this.voteTableEnsured = true;
    } catch (err) {
      this.voteTableEnsured = true;
    }
  }


  async createHotTake(authorId: string, data: {
    content: string;
    date?: string;
    place?: string;
    time?: string;
    media?: string;
    otherDetails?: string;
  }) {
    const [inserted] = await this.db
      .insert(hotTakes)
      .values({ 
        authorId, 
        content: data.content.trim(),
        date: data.date?.trim() || null,
        place: data.place?.trim() || null,
        time: data.time?.trim() || null,
        media: data.media?.trim() || null,
        otherDetails: data.otherDetails?.trim() || null,
      })
      .returning();

    // Mentions Extraction
    const trimmedContent = data.content.trim();
    if (trimmedContent) {
      const mentions = Array.from(
        new Set(trimmedContent.match(/@([\w._-]+)/g) || []),
      ).map((m) => m.slice(1));

      if (mentions.length > 0) {
        const mentionedProfiles = await this.db
          .select()
          .from(profiles)
          .where(inArray(profiles.username, mentions));

        for (const profile of mentionedProfiles) {
          if (profile.userId !== authorId) {
            await this.db
              .insert(notificationOutbox)
              .values({
                eventId: `HOTTAKE_MENTION_${inserted.id}_${profile.userId}`,
                type: 'MENTION',
                payload: {
                  actorId: authorId,
                  recipientId: profile.userId,
                  entityType: 'HOT_TAKE',
                  entityId: inserted.id,
                },
              })
              .onConflictDoNothing({
                target: [notificationOutbox.eventId],
              });
          }
        }
      }
    }

    return inserted;
  }

  async deleteHotTake(userId: string, id: string) {
    const [take] = await this.db
      .select()
      .from(hotTakes)
      .where(eq(hotTakes.id, id))
      .limit(1);

    if (!take) {
      throw new HttpException('Hot Take not found', HttpStatus.NOT_FOUND);
    }

    if (take.authorId !== userId) {
      throw new HttpException('Forbidden: You can only delete your own hot takes', HttpStatus.FORBIDDEN);
    }

    await this.db.delete(hotTakes).where(eq(hotTakes.id, id));
    return { success: true };
  }

  async adminRemoveHotTake(id: string) {
    const [take] = await this.db
      .select()
      .from(hotTakes)
      .where(eq(hotTakes.id, id))
      .limit(1);

    if (!take) {
      throw new HttpException('Hot Take not found', HttpStatus.NOT_FOUND);
    }

    await this.db.delete(hotTakes).where(eq(hotTakes.id, id));
    return { success: true };
  }

  async updateHotTake(userId: string, id: string, updateData: { content: string, date?: string, place?: string, time?: string, media?: string, otherDetails?: string }) {
    const [take] = await this.db
      .select()
      .from(hotTakes)
      .where(eq(hotTakes.id, id))
      .limit(1);

    if (!take) {
      throw new HttpException('Hot Take not found', HttpStatus.NOT_FOUND);
    }

    if (take.authorId !== userId) {
      throw new HttpException('Forbidden: You can only edit your own hot takes', HttpStatus.FORBIDDEN);
    }

    const [updated] = await this.db
      .update(hotTakes)
      .set({ 
        content: updateData.content.trim(),
        date: updateData.date || null,
        place: updateData.place || null,
        time: updateData.time || null,
        media: updateData.media || null,
        otherDetails: updateData.otherDetails || null,
      })
      .where(eq(hotTakes.id, id))
      .returning();

    return updated;
  }

  async voteHotTake(userId: string, hotTakeId: string, voteType: 'UP' | 'DOWN') {
    const [take] = await this.db
      .select({ id: hotTakes.id, authorId: hotTakes.authorId })
      .from(hotTakes)
      .where(eq(hotTakes.id, hotTakeId))
      .limit(1);

    if (!take) {
      throw new HttpException('Hot Take not found', HttpStatus.NOT_FOUND);
    }

    const [existingVote] = await this.db
      .select({ id: hotTakeVotes.id, voteType: hotTakeVotes.voteType })
      .from(hotTakeVotes)
      .where(and(eq(hotTakeVotes.hotTakeId, hotTakeId), eq(hotTakeVotes.userId, userId)))
      .limit(1);

    let newUserVote: 'UP' | 'DOWN' | null = null;

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Toggle off vote
        await this.db.delete(hotTakeVotes).where(eq(hotTakeVotes.id, existingVote.id));
        newUserVote = null;
      } else {
        // Change vote type
        await this.db
          .update(hotTakeVotes)
          .set({ voteType })
          .where(eq(hotTakeVotes.id, existingVote.id));
        newUserVote = voteType;
      }
    } else {
      // Create new vote
      await this.db.insert(hotTakeVotes).values({
        hotTakeId,
        userId,
        voteType,
      });
      newUserVote = voteType;

      // Emit notification to author if upvoted
      if (voteType === 'UP' && take.authorId !== userId) {
        await this.db
          .insert(notificationOutbox)
          .values({
            eventId: `HOTTAKE_LIKE_${hotTakeId}_${userId}`,
            type: 'POST_LIKE',
            payload: {
              actorId: userId,
              recipientId: take.authorId,
              entityType: 'HOT_TAKE',
              entityId: hotTakeId,
            },
          })
          .onConflictDoNothing({ target: [notificationOutbox.eventId] });
      }
    }

    // High performance Drizzle ORM count aggregation instead of raw string execution
    const [countsResult] = await this.db
      .select({
        upCount: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${hotTakeVotes.voteType} = 'UP'), 0)::int`,
        downCount: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${hotTakeVotes.voteType} = 'DOWN'), 0)::int`,
      })
      .from(hotTakeVotes)
      .where(eq(hotTakeVotes.hotTakeId, hotTakeId));

    const upvotesCount = Number(countsResult?.upCount || 0);
    const downvotesCount = Number(countsResult?.downCount || 0);
    const score = upvotesCount - downvotesCount;

    return {
      hotTakeId,
      userVote: newUserVote,
      upvotesCount,
      downvotesCount,
      score,
    };
  }

  async getHotTakes(userId?: string | null, limit: number = 10, offset: number = 0) {
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const safeOffset = Math.max(0, offset);

    const takes = await this.db
      .select()
      .from(hotTakes)
      .orderBy(desc(hotTakes.createdAt))
      .limit(safeLimit)
      .offset(safeOffset);

    if (takes.length === 0) return { items: [], nextOffset: null };

    const takeIds = takes.map((t) => t.id);
    const authorIds = Array.from(new Set(takes.map((t: any) => t.authorId)));

    const profilesRows = await this.db
      .select()
      .from(profiles)
      .where(inArray(profiles.userId, authorIds));

    const profileMap = new Map();
    profilesRows.forEach((p: any) => profileMap.set(p.userId, p));

    // High performance Drizzle ORM batch aggregation for vote counts
    const countsResult = await this.db
      .select({
        takeId: hotTakeVotes.hotTakeId,
        upCount: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${hotTakeVotes.voteType} = 'UP'), 0)::int`,
        downCount: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${hotTakeVotes.voteType} = 'DOWN'), 0)::int`,
      })
      .from(hotTakeVotes)
      .where(inArray(hotTakeVotes.hotTakeId, takeIds))
      .groupBy(hotTakeVotes.hotTakeId);

    const voteCountMap = new Map<string, { up: number; down: number }>();
    for (const row of countsResult) {
      voteCountMap.set(row.takeId, {
        up: Number(row.upCount || 0),
        down: Number(row.downCount || 0),
      });
    }


    // Fetch user's own votes for this batch only
    const userVoteMap = new Map<string, 'UP' | 'DOWN'>();
    if (userId && takeIds.length > 0) {
      const userVotesRows = await this.db
        .select({ hotTakeId: hotTakeVotes.hotTakeId, voteType: hotTakeVotes.voteType })
        .from(hotTakeVotes)
        .where(and(inArray(hotTakeVotes.hotTakeId, takeIds), eq(hotTakeVotes.userId, userId)));

      userVotesRows.forEach(v => userVoteMap.set(v.hotTakeId, v.voteType as 'UP' | 'DOWN'));
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

    const items = takes.map((t: any) => {
      const prof = profileMap.get(t.authorId);
      const counts = voteCountMap.get(t.id) || { up: 0, down: 0 };
      const userVote = userVoteMap.get(t.id) || null;
      const score = counts.up - counts.down;

      return {
        ...t,
        upvotesCount: counts.up,
        downvotesCount: counts.down,
        score,
        userVote,
        author: {
          id: t.authorId,
          displayName: prof?.displayName || 'Student',
          username: prof?.username || 'user',
          avatarUrl: prof?.avatarKey ? `${baseUrl}/uploads/${prof.avatarKey}` : null,
          isVerifiedIdentity: prof?.isVerifiedIdentity || false,
        }
      };
    });

    return {
      items,
      nextOffset: items.length === limit ? offset + limit : null,
    };
  }
}
