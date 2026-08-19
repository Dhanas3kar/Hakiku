import { Injectable, Inject } from '@nestjs/common';
import { db } from '../../db';
import { profiles } from '../../db/schema';
import Redis from 'ioredis';
import { eq, and, gt, count } from 'drizzle-orm';

@Injectable()
export class CampusInsightsService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async getInsights(userId: string) {
    const userProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
    });

    if (!userProfile || !userProfile.campus) {
      return {
        message: 'Campus insights require a campus to be set in your profile.',
      };
    }

    const { campus, department, batchYear } = userProfile;
    const cacheKey = `campus:insights:${campus}:${department || 'all'}:${batchYear || 'all'}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Count new students in campus
    const [newStudentsCampus] = await db
      .select({ count: count() })
      .from(profiles)
      .where(
        and(eq(profiles.campus, campus), gt(profiles.createdAt, thirtyDaysAgo)),
      );

    // Privacy threshold
    const studentsJoined =
      newStudentsCampus.count < 5 ? null : newStudentsCampus.count;

    const insights = {
      campus,
      department,
      batchYear,
      newStudentsThisMonth: studentsJoined,
      lastUpdated: new Date().toISOString(),
    };

    await this.redis.set(cacheKey, JSON.stringify(insights), 'EX', 15 * 60);

    return insights;
  }
}
