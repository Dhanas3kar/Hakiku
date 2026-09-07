import { client as apiClient } from './client'
import type { UserProfile } from './profile'

/**
 * Notification types emitted by the backend.
 */
export type NotificationType =
  | 'POST_LIKE'
  | 'POST_COMMENT'
  | 'COMMENT_REPLY'
  | 'COMMENT_LIKE'
  | 'MENTION'
  | 'FOLLOW'
  | 'MESSAGE'
  | 'NEW_MESSAGE'
  | 'CONNECTION_REQUEST'
  | 'CONNECTION_ACCEPTED'
  | 'SYSTEM'

/**
 * A single notification returned by the API.
 */
export interface NotificationItem {
  id: string
  recipientId: string
  actorId?: string
  actor?: UserProfile
  entityId?: string
  content: string
  isRead: boolean
  createdAt: string
  updatedAt: string
  type: NotificationType
  payload?: Record<string, unknown>
}

/**
 * Cursor-based notification pagination response.
 */
export interface PaginatedNotifications {
  items: NotificationItem[]
  nextCursor?: string
  hasMore: boolean
}

/**
 * Notification preference categories.
 */
export type NotificationCategory =
  | 'NETWORK'
  | 'POST_ENGAGEMENT'
  | 'SYSTEM'

/**
 * Notification delivery preferences.
 */
export interface NotificationPreference {
  category: NotificationCategory
  isEmailEnabled: boolean
  isPushEnabled: boolean
  isInAppEnabled: boolean
}

/**
 * Fields that can be changed for a notification preference.
 */
export interface UpdateNotificationPreferenceInput {
  isEmailEnabled?: boolean
  isPushEnabled?: boolean
  isInAppEnabled?: boolean
}

/**
 * Query parameters supported by the notification list endpoint.
 */
export interface GetNotificationsParams {
  [key: string]: string | number | boolean | null | undefined
  cursor?: string
  limit?: number
  unreadOnly?: boolean
}

interface NotificationsApiResponse {
  data?: NotificationItem[]
  meta?: {
    nextCursor?: string | null
    nextCursorAt?: string | null
    hasNextPage?: boolean
  }
}

export const notificationsApi = {
  /**
   * Fetch notifications using cursor-based pagination.
   */
  getNotifications: async (
    params?: GetNotificationsParams,
  ): Promise<PaginatedNotifications> => {
    const response =
      await apiClient.get<NotificationsApiResponse>(
        '/notifications',
        { params },
      )

    return {
      items: Array.isArray(response.data)
        ? response.data
        : [],

      nextCursor:
        response.meta?.nextCursor ||
        response.meta?.nextCursorAt ||
        undefined,

      hasMore:
        response.meta?.hasNextPage ?? false,
    }
  },

  /**
   * Fetch the current user's unread notification count.
   *
   * Failure is intentionally treated as zero so a notification
   * counter does not break the rest of the application.
   */
  getUnreadCount: async (): Promise<{
    unreadCount: number
  }> => {
    try {
      const response = await apiClient.get<{
        count?: number
      }>('/notifications/unread-count', {
        skipAuthRefresh: true,
      })

      return {
        unreadCount:
          typeof response.count === 'number'
            ? Math.max(0, response.count)
            : 0,
      }
    } catch {
      return {
        unreadCount: 0,
      }
    }
  },

  /**
   * Mark every notification as read.
   */
  markAllAsRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/read-all')
  },

  /**
   * Mark a single notification as read.
   */
  markAsRead: async (
    id: string,
  ): Promise<void> => {
    await apiClient.patch(
      `/notifications/${encodeURIComponent(id)}/read`,
    )
  },

  /**
   * Delete a notification.
   */
  deleteNotification: async (
    id: string,
  ): Promise<void> => {
    await apiClient.delete(
      `/notifications/${encodeURIComponent(id)}`,
    )
  },

  /**
   * Fetch notification preferences.
   */
  getPreferences: async (): Promise<
    NotificationPreference[]
  > => {
    const response =
      await apiClient.get<NotificationPreference[]>(
        '/notifications/preferences',
      )

    return Array.isArray(response)
      ? response
      : []
  },

  /**
   * Update delivery preferences for a notification category.
   */
  updatePreference: async (
    category: NotificationCategory,
    data: UpdateNotificationPreferenceInput,
  ): Promise<NotificationPreference> => {
    const response =
      await apiClient.patch<NotificationPreference>(
        `/notifications/preferences/${encodeURIComponent(
          category,
        )}`,
        data,
      )

    return response
  },
}

