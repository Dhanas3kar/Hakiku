import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { db } from '../../db';
import { confessions } from '../../db/schema';
import Redis from 'ioredis';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class ConfessionService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async submitConfession(userId: string, content: string, campus?: string) {
    const rateLimitKey = `confession:rate_limit_v6:${userId}`;
    const hasSubmittedRecently = await this.redis.get(rateLimitKey);

    const rateLimitSeconds = process.env.NODE_ENV === 'production'
      ? parseInt(process.env.CONFESSION_RATE_LIMIT_SECONDS || '30', 10)
      : 0;

    if (rateLimitSeconds > 0 && hasSubmittedRecently) {
      throw new HttpException(
        `Please wait ${rateLimitSeconds} seconds before submitting another confession.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isTest = process.env.NODE_ENV === 'test';
    const autoApprove = isTest
      ? process.env.AUTO_APPROVE_CONFESSIONS === 'true'
      : process.env.AUTO_APPROVE_CONFESSIONS !== 'false';
    const status = autoApprove ? 'PUBLISHED' : 'PENDING_MODERATION';
    const publishedAt = autoApprove ? new Date() : null;

    const [confession] = await db
      .insert(confessions)
      .values({
        authorId: userId,
        content,
        campus,
        status,
        publishedAt,
      })
      .returning();

    // Set configurable rate limit
    if (rateLimitSeconds > 0) {
      await this.redis.set(rateLimitKey, '1', 'EX', rateLimitSeconds);
    }

    return {
      message: autoApprove ? 'Confession published successfully' : 'Confession submitted for moderation',
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
