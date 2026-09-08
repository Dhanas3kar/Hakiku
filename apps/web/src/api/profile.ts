import { client } from './client'

export type UserRole = 'STUDENT' | 'MODERATOR' | 'ADMIN'

export interface UserProfile {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  fullName?: string; // alias for displayName for backward compat
  bio: string | null;
  about?: string | null;
  department: string | null;
  batch: string | null;
  batchYear?: number | null;
  graduationYear?: number | null;
  campus?: string | null;

  avatarUrl: string | null;
  coverUrl: string | null;
  socialLinks: Record<string, string> | null;
  followersCount?: number;
  followingCount?: number;
  role?: UserRole;
  status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DEACTIVATED' | null;
  suspendedUntil?: string | null;
  suspensionReason?: string | null;
  adminHandle?: string | null;
  isVerifiedIdentity?: boolean;
  skillIds?: string[];
  interestIds?: string[];
  skills?: { id: string; name: string; category?: string }[];
  interests?: { id: string; name: string; category?: string }[];
  createdAt: string;
  updatedAt: string;
}

export const profileApi = {
  getMe: async (): Promise<UserProfile | null> => {
    try {
      return await client.get('/profile/me')
    } catch (error: any) {
      if (error?.status === 404) return null
      throw error
    }
  },
  onboarding: (data: Partial<UserProfile>) => client.post('/profile/onboarding', data),
  updateMe: (data: Partial<UserProfile>) => client.patch('/profile/me', data),
  uploadAvatar: (file: File) => {
    return client.post('/profile/me/avatar', file, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Type': file.type || 'image/jpeg',
      },
    })
  },
  uploadCover: (file: File) => {
    return client.post('/profile/me/cover', file, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Type': file.type || 'image/jpeg',
      },
    })
  },
  getByUsername: (username: string): Promise<UserProfile> => client.get(`/profile/username/${username}`),
  getByUserId: (userId: string): Promise<UserProfile> => client.get(`/profile/id/${userId}`),

  searchProfiles: async (params: { query?: string; campus?: string; department?: string; batchYear?: number; cursor?: string; limit?: number }): Promise<{ items: UserProfile[], nextCursor: string | null }> => {
    const res = await client.get('/profile/search', { params })
    return {
      items: res.data || [],
      nextCursor: res.meta?.nextCursor || null
    }
  },
  searchSkills: async (query?: string, limit?: number): Promise<any[]> => {
    const res = await client.get('/skills', { params: { query, limit } })
    return res
  },
  searchInterests: async (query?: string, limit?: number): Promise<any[]> => {
    const res = await client.get('/interests', { params: { query, limit } })
    return res
  },
}
