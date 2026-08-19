import { client as apiClient } from './client'
import type { UserProfile } from './profile'

export type NotificationType = 
  | 'LIKE' 
  | 'COMMENT' 
  | 'MENTION' 
  | 'CONNECTION_REQUEST' 
  | 'CONNECTION_ACCEPTED'
  | 'SYSTEM'

export interface NotificationItem {
  id: string
  recipientId: string
  actorId?: string
  actor?: UserProfile
  type: NotificationType
  entityId?: string
  content: string
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export interface PaginatedNotifications {
  items: NotificationItem[]
  nextCursor?: string
  hasMore: boolean
}

export type NotificationCategory = 'POSTS' | 'CONNECTIONS' | 'MESSAGES' | 'SYSTEM'

export interface NotificationPreference {
  category: NotificationCategory
  emailEnabled: boolean
  pushEnabled: boolean
  inAppEnabled: boolean
}

export const notificationsApi = {
  getNotifications: async (params?: { cursor?: string; limit?: number; unreadOnly?: boolean }): Promise<PaginatedNotifications> => {
    const response = await apiClient.get('/notifications', { params })
    return response
  },

  getUnreadCount: async (): Promise<{ unreadCount: number }> => {
    const response = await apiClient.get('/notifications/unread-count')
    return response
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/read-all')
  },

  markAsRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`)
  },

  deleteNotification: async (id: string): Promise<void> => {
    await apiClient.delete(`/notifications/${id}`)
  },

  getPreferences: async (): Promise<NotificationPreference[]> => {
    const response = await apiClient.get('/notifications/preferences')
    return response
  },

  updatePreference: async (
    category: NotificationCategory, 
    data: { emailEnabled?: boolean; pushEnabled?: boolean; inAppEnabled?: boolean }
  ): Promise<NotificationPreference> => {
    const response = await apiClient.patch(`/notifications/preferences/${category}`, data)
    return response
  }
}
