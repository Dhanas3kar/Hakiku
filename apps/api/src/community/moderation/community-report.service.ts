import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { db } from '../../db';
import { communityReports } from '../../db/schema';

@Injectable()
export class CommunityReportService {
  async reportContent(
    reporterId: string,
    targetType: 'CONFESSION' | 'POLL' | 'POST' | 'COMMENT' | 'USER',
    targetId: string,
    reason: string,
  ) {
    if (targetType === 'USER' && reporterId === targetId) {
      throw new HttpException(
        'You cannot report yourself',
        HttpStatus.BAD_REQUEST,
      );
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
