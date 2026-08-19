import { db } from '../../db/index';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import { notifications, users } from '../../db/schema';
import * as schema from '../../db/schema';
import { NotificationsQueryDto } from '../dto/notifications.dto';
import { NotificationPrivacyService } from './notification-privacy.service';
import { NotificationPreferenceService } from './notification-preference.service';

@Injectable()
export class NotificationService {
  private db;

  constructor(
    private readonly privacyService: NotificationPrivacyService,
    private readonly preferenceService: NotificationPreferenceService,
  ) {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://srm_admin:srm_password@localhost:5432/srm_connect';
    this.db = db;
  }

  async getNotifications(userId: string, query: NotificationsQueryDto) {
    const limit = Math.min(query.limit || 20, 50);

    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;
    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf-8'),
        );
        cursorCreatedAt = new Date(decoded.createdAt);
        cursorId = decoded.id;
      } catch (err) {
        // Invalid cursor, ignore
      }
    }

    const conditions = [eq(notifications.recipientId, userId)];

    if (cursorCreatedAt && cursorId) {
      conditions.push(
        sql`(${notifications.createdAt}, ${notifications.id}) < (${cursorCreatedAt.toISOString()}, ${cursorId})`,
      );
    }

    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const pageData = hasNextPage ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasNextPage && pageData.length > 0) {
      const lastItem = pageData[pageData.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: lastItem.createdAt, id: lastItem.id }),
      ).toString('base64');
    }

    return {
      data: pageData,
      meta: {
        hasNextPage,
        nextCursor,
        limit,
      },
    };
  }

  async getUnreadCount(userId: string) {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false),
        ),
      );

    return { count: result?.count || 0 };
  }

  async markAsRead(userId: string, notificationId: string) {
    const [existing] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (existing.isRead) {
      return { message: 'Notification already read' };
    }

    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, notificationId));

    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false),
        ),
      );

    return { message: 'All notifications marked as read' };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const deleted = await this.db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, userId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      throw new NotFoundException('Notification not found');
    }

    return { message: 'Notification deleted' };
  }
}
