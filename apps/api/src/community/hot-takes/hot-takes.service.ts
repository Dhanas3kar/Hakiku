import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { db } from '../../db/index';
import { hotTakes, profiles, notificationOutbox } from '../../db/schema';
import { desc, eq, inArray } from 'drizzle-orm';

@Injectable()
export class HotTakesService {
  private db = db;

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

  async getHotTakes(limit: number = 10, offset: number = 0) {
    const takes = await this.db
      .select()
      .from(hotTakes)
      .orderBy(desc(hotTakes.createdAt))
      .limit(limit)
      .offset(offset);

    if (takes.length === 0) return { items: [], nextOffset: null };

    const authorIds = Array.from(new Set(takes.map((t: any) => t.authorId)));
    const profilesRows = await this.db
      .select()
      .from(profiles)
      .where(inArray(profiles.userId, authorIds));

    const profileMap = new Map();
    profilesRows.forEach((p: any) => profileMap.set(p.userId, p));
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

    const items = takes.map((t: any) => {
      const prof = profileMap.get(t.authorId);
      return {
        ...t,
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
