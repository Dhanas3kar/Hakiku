import { Injectable, Inject } from '@nestjs/common';
import { db } from '../../db';
import { posts, comments, connections } from '../../db/schema';
import Redis from 'ioredis';
import { gt, count } from 'drizzle-orm';

@Injectable()
export class CampusPulseService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  async getGlobalPulse() {
    const CACHE_KEY = 'campus:pulse:global';
    
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [recentPosts] = await db.select({ count: count() }).from(posts).where(gt(posts.createdAt, fortyEightHoursAgo));
    const [recentComments] = await db.select({ count: count() }).from(comments).where(gt(comments.createdAt, fortyEightHoursAgo));
    const [recentConnections] = await db.select({ count: count() }).from(connections).where(gt(connections.createdAt, fortyEightHoursAgo));

    const pulse = {
      activePosts: recentPosts.count,
      activeComments: recentComments.count,
      newConnections: recentConnections.count,
      lastUpdated: new Date().toISOString()
    };

    // Cache for 10 minutes
    await this.redis.set(CACHE_KEY, JSON.stringify(pulse), 'EX', 10 * 60);

    return pulse;
  }
}
