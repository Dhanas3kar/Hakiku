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
}

export const confessionsApi = {
  getHeroConfession: async (): Promise<{items: HeroConfession[], isFallback: boolean}> => {
    try {
      return await client.get('/community/confessions/hero', { skipAuthRefresh: true })
    } catch {
      return { items: [], isFallback: false }
    }
  },
}
