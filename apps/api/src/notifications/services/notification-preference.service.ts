import { db } from '../../db/index';
import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { notificationPreferences } from '../../db/schema';
import * as schema from '../../db/schema';
import { UpdatePreferencesDto } from '../dto/notifications.dto';

export type NotificationCategory = 'NETWORK' | 'POST_ENGAGEMENT' | 'SYSTEM';

@Injectable()
export class NotificationPreferenceService {
  private db;

  constructor() {
    this.db = db;
  }

  mapTypeToCategory(type: string): NotificationCategory {
    switch (type) {
      case 'FOLLOW':
      case 'CONNECTION_REQUEST':
      case 'CONNECTION_ACCEPTED':
        return 'NETWORK';
      case 'POST_LIKE':
      case 'POST_COMMENT':
      case 'COMMENT_REPLY':
        return 'POST_ENGAGEMENT';
      case 'SYSTEM':
        return 'SYSTEM';
      default:
        return 'SYSTEM';
    }
  }

  async shouldDeliverInApp(userId: string, type: string): Promise<boolean> {
    const category = this.mapTypeToCategory(type);
    if (category === 'SYSTEM') return true;

    const [pref] = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.category, category),
        ),
      )
      .limit(1);

    // Default to true if no preference is explicitly set
    if (!pref) return true;

    return pref.isInAppEnabled;
  }

  async getPreferences(userId: string) {
    const prefs = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    // Ensure default categories exist in response
    const defaultCategories: NotificationCategory[] = [
      'NETWORK',
      'POST_ENGAGEMENT',
    ];
    const result = [];

    for (const cat of defaultCategories) {
      const existing = prefs.find((p) => p.category === cat);
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          userId,
          category: cat,
          isEmailEnabled: true,
          isPushEnabled: true,
          isInAppEnabled: true,
          updatedAt: new Date(),
        });
      }
    }

    return result;
  }

  async updatePreference(
    userId: string,
    category: NotificationCategory,
    dto: UpdatePreferencesDto,
  ) {
    const [existing] = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.category, category),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(notificationPreferences)
        .set({
          isEmailEnabled:
            dto.isEmailEnabled !== undefined
              ? dto.isEmailEnabled
              : existing.isEmailEnabled,
          isPushEnabled:
            dto.isPushEnabled !== undefined
              ? dto.isPushEnabled
              : existing.isPushEnabled,
          isInAppEnabled:
            dto.isInAppEnabled !== undefined
              ? dto.isInAppEnabled
              : existing.isInAppEnabled,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(notificationPreferences.userId, userId),
            eq(notificationPreferences.category, category),
          ),
        )
        .returning();
      return updated;
    } else {
      const [inserted] = await this.db
        .insert(notificationPreferences)
        .values({
          userId,
          category,
          isEmailEnabled:
            dto.isEmailEnabled !== undefined ? dto.isEmailEnabled : true,
          isPushEnabled:
            dto.isPushEnabled !== undefined ? dto.isPushEnabled : true,
          isInAppEnabled:
            dto.isInAppEnabled !== undefined ? dto.isInAppEnabled : true,
        })
        .returning();
      return inserted;
    }
  }
}
