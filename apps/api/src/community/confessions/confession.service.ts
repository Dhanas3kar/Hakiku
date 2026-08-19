import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { db } from '../../db';
import { confessions } from '../../db/schema';
import Redis from 'ioredis';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class ConfessionService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async submitConfession(userId: string, content: string, campus?: string) {
    const rateLimitKey = `confession:rate_limit:${userId}`;
    const hasSubmittedRecently = await this.redis.get(rateLimitKey);

    if (hasSubmittedRecently) {
      throw new HttpException(
        'You can only submit one confession every 12 hours.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [confession] = await db
      .insert(confessions)
      .values({
        authorId: userId,
        content,
        campus,
        status: 'PENDING_MODERATION',
      })
      .returning();

    // Set 12 hour rate limit
    await this.redis.set(rateLimitKey, '1', 'EX', 12 * 60 * 60);

    return {
      message: 'Confession submitted for moderation',
      id: confession.id,
    };
  }

  async deleteOwnConfession(userId: string, confessionId: string) {
    const confession = await db.query.confessions.findFirst({
      where: and(
        eq(confessions.id, confessionId),
        eq(confessions.authorId, userId),
      ),
    });

    if (!confession) {
      throw new HttpException(
        'Confession not found or not yours',
        HttpStatus.NOT_FOUND,
      );
    }

    await db
      .update(confessions)
      .set({ status: 'REMOVED' })
      .where(eq(confessions.id, confessionId));

    return { message: 'Confession removed' };
  }
}
