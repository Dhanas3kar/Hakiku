import { client } from './client'

export interface UserProfile {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  fullName?: string; // alias for displayName for backward compat
  bio: string | null;
  department: string | null;
  batch: string | null;
  batchYear?: number | null;
  campus?: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  socialLinks: Record<string, string> | null;
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
        'Content-Type': file.type,
      },
    })
  },
  uploadCover: (file: File) => {
    return client.post('/profile/me/cover', file, {
      headers: {
        'Content-Type': file.type,
      },
    })
  },
  getByUsername: (username: string): Promise<UserProfile> => client.get(`/profile/username/${username}`),
}
