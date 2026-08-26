import { client as apiClient } from './client'
import type { UserProfile } from './profile'

export type NotificationType = 
  | 'POST_LIKE' 
  | 'POST_COMMENT' 
  | 'COMMENT_REPLY' 
  | 'FOLLOW'
  | 'MESSAGE'
  | 'CONNECTION_REQUEST' 
  | 'CONNECTION_ACCEPTED'
  | 'SYSTEM'

export type NotificationPayload = 
  | { type: 'POST_LIKE'; payload?: { postId: string; actorId?: string } }
  | { type: 'POST_COMMENT'; payload?: { postId: string; commentId?: string; actorId?: string } }
  | { type: 'COMMENT_REPLY'; payload?: { postId: string; commentId?: string; actorId?: string } }
  | { type: 'FOLLOW'; payload?: any }
  | { type: 'MESSAGE'; payload?: { conversationId?: string } }
  | { type: 'CONNECTION_REQUEST'; payload?: any }
  | { type: 'CONNECTION_ACCEPTED'; payload?: any }
  | { type: 'SYSTEM'; payload?: any }

export type NotificationItem = {
  id: string
  recipientId: string
  actorId?: string
  actor?: UserProfile
  entityId?: string
  content: string
  isRead: boolean
  createdAt: string
  updatedAt: string
} & NotificationPayload


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
    const response = await apiClient.get<any>('/notifications', { params })
    return {
      items: response.data || [],
      nextCursor: response.meta?.nextCursor || undefined,
      hasMore: response.meta?.hasNextPage || false
    }
  },

  getUnreadCount: async (): Promise<{ unreadCount: number }> => {
    const response = await apiClient.get<any>('/notifications/unread-count')
    return { unreadCount: response.count || 0 }
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
