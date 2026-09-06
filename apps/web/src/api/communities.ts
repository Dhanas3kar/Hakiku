import { apiClient } from './client';

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  ownerId: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  category: string;
  memberCount?: number;
  userRole?: 'OWNER' | 'MODERATOR' | 'MEMBER' | null;
  isMember?: boolean;
  channels?: CommunityChannel[];
  createdAt: string;
}

export interface CommunityChannel {
  id: string;
  communityId: string;
  name: string;
  slug: string;
  type: 'TEXT';
  description: string | null;
  displayOrder: number;
  isPrivate: boolean;
  createdAt: string;
}

export interface CommunityMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'MODERATOR' | 'MEMBER';
  joinedAt: string;
  profile?: {
    fullName: string | null;
    avatarUrl: string | null;
    bio?: string | null;
    department?: string | null;
  };
}

export interface CommunityMessage {
  id: string;
  channelId: string;
  communityId: string;
  senderId: string;
  content: string;
  createdAt: string;
  senderName?: string | null;
  senderAvatar?: string | null;
}

export const communitiesApi = {
  getCommunities: (params?: { search?: string; category?: string; visibility?: string; page?: number; limit?: number }) =>
    apiClient.get<{ items: Community[]; total: number }>('/communities', { params }),

  getMyCommunities: () =>
    apiClient.get<Community[]>('/communities/my'),

  getCommunityBySlugOrId: (idOrSlug: string) =>
    apiClient.get<Community>(`/communities/${idOrSlug}`),

  createCommunity: (data: { name: string; description?: string; visibility?: string; category?: string }) =>
    apiClient.post<Community>('/communities', data),

  joinCommunity: (id: string) =>
    apiClient.post<{ success: boolean; role: string }>(`/communities/${id}/join`),

  leaveCommunity: (id: string) =>
    apiClient.post<{ success: boolean }>(`/communities/${id}/leave`),

  deleteCommunity: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/communities/${id}`),

  getMembers: (id: string, page = 1, limit = 50) =>
    apiClient.get<CommunityMember[]>(`/communities/${id}/members`, { params: { page, limit } }),

  createChannel: (communityId: string, data: { name: string; description?: string; isPrivate?: boolean }) =>
    apiClient.post<CommunityChannel>(`/communities/${communityId}/channels`, data),

  getChannelMessages: (communityId: string, channelId: string, page = 1) =>
    apiClient.get<CommunityMessage[]>(`/communities/${communityId}/channels/${channelId}/messages`, {
      params: { page },
    }),

  sendChannelMessage: (communityId: string, channelId: string, content: string) =>
    apiClient.post<CommunityMessage>(`/communities/${communityId}/channels/${channelId}/messages`, {
      content,
    }),
};

