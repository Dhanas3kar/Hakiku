import { client } from './client'

// --- Types ---

export type ConnectionStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'CONNECTED'

export interface RelationshipStatus {
  targetUserId: string
  isFollowing: boolean
  isFollowedBy: boolean
  connectionStatus: ConnectionStatus
  pendingRequestId?: string
  isBlockedByMe: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    nextCursor: string | null
    hasMore: boolean
  }
}

export interface ConnectionRequestItem {
  requestId: string
  senderId: string
  senderEmail: string
  createdAt: string
}

export interface OutgoingRequestItem {
  requestId: string
  receiverId: string
  receiverEmail: string
  createdAt: string
}

export interface ConnectionItem {
  connectedUserId: string
  createdAt: string
}

// --- API Methods ---

export const networkingApi = {
  // Follow
  followUser: (targetUserId: string) =>
    client.post(`/networking/follow/${targetUserId}`),

  unfollowUser: (targetUserId: string) =>
    client.delete(`/networking/follow/${targetUserId}`),

  getFollowers: (userId: string, params?: { limit?: number; cursor?: string }): Promise<PaginatedResponse<any>> =>
    client.get(`/networking/followers/${userId}`, { params }),

  getFollowing: (userId: string, params?: { limit?: number; cursor?: string }): Promise<PaginatedResponse<any>> =>
    client.get(`/networking/following/${userId}`, { params }),

  // Connections
  sendConnectionRequest: (targetUserId: string) =>
    client.post(`/networking/connections/request/${targetUserId}`),

  acceptConnectionRequest: (requestId: string) =>
    client.post(`/networking/connections/accept/${requestId}`),

  rejectConnectionRequest: (requestId: string) =>
    client.post(`/networking/connections/reject/${requestId}`),

  cancelConnectionRequest: (requestId: string) =>
    client.delete(`/networking/connections/request/${requestId}`),

  removeConnection: (targetUserId: string) =>
    client.delete(`/networking/connections/${targetUserId}`),

  getConnections: (params?: { limit?: number; cursor?: string }): Promise<PaginatedResponse<ConnectionItem>> =>
    client.get('/networking/connections', { params }),

  getPendingRequests: (params?: { limit?: number; cursor?: string }): Promise<PaginatedResponse<ConnectionRequestItem>> =>
    client.get('/networking/connections/requests/pending', { params }),

  getSentRequests: (params?: { limit?: number; cursor?: string }): Promise<PaginatedResponse<OutgoingRequestItem>> =>
    client.get('/networking/connections/requests/sent', { params }),

  // Block
  blockUser: (targetUserId: string) =>
    client.post(`/networking/block/${targetUserId}`),

  unblockUser: (targetUserId: string) =>
    client.delete(`/networking/block/${targetUserId}`),

  getBlockedUsers: (params?: { limit?: number; cursor?: string }): Promise<PaginatedResponse<any>> =>
    client.get('/networking/blocks', { params }),

  // Relationship Status
  getRelationshipStatus: (targetUserId: string): Promise<RelationshipStatus> =>
    client.get(`/networking/status/${targetUserId}`),
}
