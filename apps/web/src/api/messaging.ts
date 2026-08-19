import { client as apiClient } from './client'
import type { UserProfile } from './profile'

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE'

export interface MessageMedia {
  url: string
  type: string
}

export interface MessageItem {
  id: string
  conversationId: string
  senderId: string
  content: string | null
  messageType: MessageType
  media: MessageMedia[] | null
  replyToMessageId: string | null
  replyToMessage?: {
    id: string
    content: string
    senderId: string
  }
  isEdited: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface ConversationItem {
  id: string
  targetUser: {
    id: string
    username: string
    displayName: string
    avatarKey?: string | null
    avatarUrl?: string | null
  } | null
  createdAt: string
  updatedAt: string
  latestMessage?: MessageItem
  unreadCount?: number
}

export interface PaginatedConversations {
  items: ConversationItem[]
  nextCursor?: string
  hasMore: boolean
}

export interface PaginatedMessages {
  items: MessageItem[]
  nextCursorAt?: string
  nextCursorId?: string
  hasMore: boolean
}

export const messagingApi = {
  getConversations: async (params?: { cursorAt?: string; limit?: number }): Promise<PaginatedConversations> => {
    const response = await apiClient.get('/messages/conversations', { params })
    return response
  },

  createConversation: async (targetUserId: string): Promise<ConversationItem> => {
    const response = await apiClient.post('/messages/conversations', { targetUserId })
    return response
  },

  getMessages: async (
    conversationId: string,
    params?: { cursorAt?: string; cursorId?: string; limit?: number }
  ): Promise<PaginatedMessages> => {
    const response = await apiClient.get(`/messages/conversations/${conversationId}/messages`, { params })
    return response
  },

  sendMessage: async (
    conversationId: string,
    payload: { content?: string; messageType?: MessageType; mediaKeys?: string[]; replyToMessageId?: string }
  ): Promise<MessageItem> => {
    const response = await apiClient.post(`/messages/conversations/${conversationId}/messages`, payload)
    return response
  },

  editMessage: async (messageId: string, content: string): Promise<MessageItem> => {
    const response = await apiClient.patch(`/messages/${messageId}`, { content })
    return response
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await apiClient.delete(`/messages/${messageId}`)
  },

  markAsRead: async (conversationId: string, messageId: string): Promise<void> => {
    await apiClient.post(`/messages/conversations/${conversationId}/read`, { messageId })
  },

  getUnreadCount: async (): Promise<{ unreadCount: number }> => {
    const response = await apiClient.get('/messages/unread-count')
    return response
  },

  requestMediaUpload: async (mimeType: string, fileSize: number): Promise<{ uploadUrl: string; mediaKey: string; downloadUrl: string }> => {
    const response = await apiClient.post('/messages/media/upload', { mimeType, fileSize })
    return response
  },

  // Helper method to actually upload the file to S3 after getting presigned URL
  uploadMedia: async (file: File): Promise<{ mediaKey: string; downloadUrl: string }> => {
    const { uploadUrl, mediaKey, downloadUrl } = await messagingApi.requestMediaUpload(file.type, file.size)
    
    // Perform PUT request directly to S3/R2 presigned URL
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    })
    
    return { mediaKey, downloadUrl }
  }
}
