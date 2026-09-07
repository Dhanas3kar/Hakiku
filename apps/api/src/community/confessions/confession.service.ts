import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { db } from '../../db';
import { confessions, confessionUpvotes } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';

@Injectable()
export class ConfessionService {
  async submitConfession(authorId: string, content: string, campus?: string) {
    if (!content || !content.trim()) {
      throw new HttpException('Confession content cannot be empty', HttpStatus.BAD_REQUEST);
    }

    const [confession] = await db
      .insert(confessions)
      .values({
        authorId,
        content: content.trim(),
        campus: campus || null,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        upvoteCount: 0,
      })
      .returning();

    return {
      message: 'Confession submitted successfully',
      id: confession.id,
      content: confession.content,
      campus: confession.campus,
      status: confession.status,
      upvoteCount: 0,
    };
  }

  async toggleUpvote(userId: string, confessionId: string) {
    const [confession] = await db
      .select({ id: confessions.id, upvoteCount: confessions.upvoteCount })
      .from(confessions)
      .where(and(eq(confessions.id, confessionId), eq(confessions.status, 'PUBLISHED')))
      .limit(1);

    if (!confession) {
      throw new HttpException('Confession not found or not published', HttpStatus.NOT_FOUND);
    }

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(confessionUpvotes)
        .where(
          and(
            eq(confessionUpvotes.confessionId, confessionId),
            eq(confessionUpvotes.userId, userId),
          ),
        )
        .limit(1);

      let isUpvoted = false;

      if (existing) {
        await tx
          .delete(confessionUpvotes)
          .where(
            and(
              eq(confessionUpvotes.confessionId, confessionId),
              eq(confessionUpvotes.userId, userId),
            ),
          );

        await tx
          .update(confessions)
          .set({
            upvoteCount: sql`GREATEST(0, ${confessions.upvoteCount} - 1)`,
          })
          .where(eq(confessions.id, confessionId));

        isUpvoted = false;
      } else {
        await tx.insert(confessionUpvotes).values({
          confessionId,
          userId,
        });

        await tx
          .update(confessions)
          .set({
            upvoteCount: sql`${confessions.upvoteCount} + 1`,
          })
          .where(eq(confessions.id, confessionId));

        isUpvoted = true;
      }

      const [updated] = await tx
        .select({ upvoteCount: confessions.upvoteCount })
        .from(confessions)
        .where(eq(confessions.id, confessionId))
        .limit(1);

      return {
        message: isUpvoted ? 'Upvoted successfully' : 'Upvote removed',
        confessionId,
        isUpvoted,
        upvoteCount: updated?.upvoteCount ?? (isUpvoted ? confession.upvoteCount + 1 : Math.max(0, confession.upvoteCount - 1)),
      };
    });
  }

  async deleteOwnConfession(userId: string, confessionId: string) {
    const [confession] = await db
      .select({ authorId: confessions.authorId })
      .from(confessions)
      .where(eq(confessions.id, confessionId))
      .limit(1);

    if (!confession) {
      throw new HttpException('Confession not found', HttpStatus.NOT_FOUND);
    }

    if (confession.authorId !== userId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    await db
      .update(confessions)
      .set({ status: 'REMOVED' })
      .where(eq(confessions.id, confessionId));

    return { message: 'Confession deleted successfully', confessionId };
  }
}
