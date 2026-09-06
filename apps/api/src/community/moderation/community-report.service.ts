import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { db } from '../../db';
import { communityReports, hotTakes, messages, conversationParticipants } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class CommunityReportService {
  async reportContent(
    reporterId: string,
    targetType: 'CONFESSION' | 'POLL' | 'POST' | 'COMMENT' | 'USER' | 'HOT_TAKE' | 'MESSAGE',
    targetId: string,
    reason: string,
  ) {
    if (targetType === 'USER' && reporterId === targetId) {
      throw new HttpException(
        'You cannot report yourself',
        HttpStatus.BAD_REQUEST,
      );
    }

    let snapshotContent: string | null = null;

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

    if (targetType === 'MESSAGE') {
      const [msg] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, targetId))
        .limit(1);

      if (!msg) {
        throw new NotFoundException('Message not found');
      }

      if (msg.senderId === reporterId) {
        throw new HttpException(
          'You cannot report your own message',
          HttpStatus.BAD_REQUEST,
        );
      }

      const [participant] = await db
        .select()
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, msg.conversationId),
            eq(conversationParticipants.userId, reporterId),
          ),
        )
        .limit(1);

      if (!participant) {
        throw new HttpException(
          'You are not a participant in this conversation',
          HttpStatus.FORBIDDEN,
        );
      }

      snapshotContent = msg.content || null;
    }

    // Check for duplicate report across all target types
    const [existingReport] = await db
      .select()
      .from(communityReports)
      .where(
        and(
          eq(communityReports.reporterId, reporterId),
          eq(communityReports.targetType, targetType),
          eq(communityReports.targetId, targetId),
        ),
      )
      .limit(1);

    if (existingReport) {
      throw new HttpException(
        'You have already reported this content',
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
        snapshotContent,
        status: 'PENDING',
      })
      .returning();

    return {
      message: 'Report submitted successfully',
      id: report.id,
    };
  }
}
