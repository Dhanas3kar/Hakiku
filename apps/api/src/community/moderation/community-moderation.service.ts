import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { db } from '../../db';
import { communityReports } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class CommunityModerationService {
  
  async getPendingReports() {
    return db.query.communityReports.findMany({
      where: eq(communityReports.status, 'PENDING'),
      orderBy: [desc(communityReports.createdAt)],
    });
  }

  async resolveReport(reportId: string, actionDetails?: string) {
    const report = await db.query.communityReports.findFirst({
      where: eq(communityReports.id, reportId)
    });

    if (!report) {
      throw new HttpException('Report not found', HttpStatus.NOT_FOUND);
    }

    await db.update(communityReports).set({
      status: 'RESOLVED',
    }).where(eq(communityReports.id, reportId));

    return { message: 'Report resolved', id: reportId };
  }

  async dismissReport(reportId: string) {
    const report = await db.query.communityReports.findFirst({
      where: eq(communityReports.id, reportId)
    });

    if (!report) {
      throw new HttpException('Report not found', HttpStatus.NOT_FOUND);
    }

    await db.update(communityReports).set({
      status: 'DISMISSED',
    }).where(eq(communityReports.id, reportId));

    return { message: 'Report dismissed', id: reportId };
  }
}
