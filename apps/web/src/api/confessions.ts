import { client } from './client'

export interface HeroConfession {
  id: string
  content: string
  campus?: string | null
  createdAt?: string
  publishedAt?: string
  expiresAt?: string
  isAuthor?: boolean
  imageUrl?: string | null
  authorName?: string | null
  upvoteCount?: number
  isUpvoted?: boolean
  targetHandle?: string | null
}

export const confessionsApi = {
  getHeroConfession: async (): Promise<{items: HeroConfession[], isFallback: boolean}> => {
    try {
      return await client.get('/community/confessions/hero', { skipAuthRefresh: true })
    } catch {
      return { items: [], isFallback: false }
    }
  },

  upvoteConfession: async (id: string): Promise<{ confessionId: string; isUpvoted: boolean; upvoteCount: number }> => {
    return await client.post(`/community/confessions/${id}/upvote`)
  },
}
