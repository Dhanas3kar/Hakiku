import { db } from '../../db/index';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, sql, desc, count, ilike, or } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { PostsService } from '../../posts/services/posts.service';
import { CommentsService } from '../../posts/services/comments.service';

@Injectable()
export class AdminService {
  private db;

  constructor(
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
  ) {
    this.db = db;
  }

  // === Reports ===

  async getReports(
    status: 'PENDING' | 'RESOLVED' | 'DISMISSED' = 'PENDING',
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;

    const rows = await this.db
      .select()
      .from(schema.communityReports)
      .where(eq(schema.communityReports.status, status))
      .orderBy(desc(schema.communityReports.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.communityReports)
      .where(eq(schema.communityReports.status, status));

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async resolveReport(
    adminId: string,
    reportId: string,
    action: 'DISMISS' | 'REMOVE_CONTENT',
    reason?: string,
  ) {
    const [report] = await this.db
      .select()
      .from(schema.communityReports)
      .where(eq(schema.communityReports.id, reportId))
      .limit(1);

    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'PENDING')
      throw new BadRequestException('Report is already processed');

    await this.db.transaction(async (tx: any) => {
      // Update report status
      const newStatus = action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
      await tx
        .update(schema.communityReports)
        .set({ status: newStatus, resolvedAt: new Date() })
        .where(eq(schema.communityReports.id, reportId));

      // Audit Log
      await tx.insert(schema.auditLogs).values({
        userId: adminId,
        event:
          action === 'DISMISS'
            ? 'REPORT_DISMISSED'
            : 'REPORT_RESOLVED',
        metadata: {
          reason,
          targetType: report.targetType,
          targetId: report.targetId,
          reportId,
        },
      });
    });

    if (action === 'REMOVE_CONTENT') {
      if (report.targetType === 'POST') {
        await this.postsService.adminSoftDeletePost(
          adminId,
          report.targetId,
          reason || 'Report resolved',
        );
      } else if (report.targetType === 'COMMENT') {
        await this.commentsService.adminSoftDeleteComment(
          adminId,
          report.targetId,
          reason || 'Report resolved',
        );
      }
    }

    return {
      message: `Report ${action.toLowerCase()}ed successfully`,
      reportId,
    };
  }

  // === Users ===

  async searchUsers(query: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query) {
      conditions.push(
        or(
          ilike(schema.profiles.displayName, `%${query}%`),
          ilike(schema.profiles.username, `%${query}%`),
          ilike(schema.users.email, `%${query}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? or(...conditions) : undefined;

    const rows = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        status: schema.users.status,
        role: schema.users.role,
        username: schema.profiles.username,
        displayName: schema.profiles.displayName,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .leftJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
      .where(whereClause)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.users)
      .leftJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
      .where(whereClause);

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async setUserStatus(
    adminId: string,
    targetUserId: string,
    status: 'ACTIVE' | 'BANNED',
    reason: string,
  ) {
    if (adminId === targetUserId)
      throw new BadRequestException('Cannot modify your own status');

    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');

    if (user.status === status)
      return { message: `User is already ${status}`, userId: targetUserId };

    await this.db.transaction(async (tx: any) => {
      await tx
        .update(schema.users)
        .set({ status, updatedAt: new Date() })
        .where(eq(schema.users.id, targetUserId));

      await tx.insert(schema.auditLogs).values({
        adminId,
        event:
          status === 'BANNED' ? 'ADMIN_SUSPEND_USER' : 'ADMIN_RESTORE_USER',
        targetId: targetUserId,
        metadata: { reason },
      });
    });

    return {
      message: `User ${status.toLowerCase()} successfully`,
      userId: targetUserId,
    };
  }

  // === Direct Moderation ===

  async moderatePost(adminId: string, postId: string, reason: string) {
    return this.postsService.adminSoftDeletePost(adminId, postId, reason);
  }

  async moderateComment(adminId: string, commentId: string, reason: string) {
    return this.commentsService.adminSoftDeleteComment(
      adminId,
      commentId,
      reason,
    );
  }
}
