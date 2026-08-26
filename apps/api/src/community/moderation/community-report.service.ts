import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { db } from '../../db';
import { communityReports, hotTakes } from '../../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class CommunityReportService {
  async reportContent(
    reporterId: string,
    targetType: 'CONFESSION' | 'POLL' | 'POST' | 'COMMENT' | 'USER' | 'HOT_TAKE',
    targetId: string,
    reason: string,
  ) {
    if (targetType === 'USER' && reporterId === targetId) {
      throw new HttpException(
        'You cannot report yourself',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (targetType === 'HOT_TAKE') {
      const [hotTake] = await db
        .select({ authorId: hotTakes.authorId })
        .from(hotTakes)
        .where(eq(hotTakes.id, targetId))
        .limit(1);

      if (!hotTake) {
        throw new NotFoundException('Hot Take not found');
      }

      if (hotTake.authorId === reporterId) {
        throw new HttpException(
          'You cannot report your own Hot Take',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const [report] = await db
      .insert(communityReports)
      .values({
        reporterId,
        targetType,
        targetId,
        reason,
        status: 'PENDING',
      })
      .returning();

    return {
      message: 'Report submitted successfully',
      id: report.id,
    };
  }
}
