import { client } from './client'

export interface HeroConfession {
  id: string
  content: string
  campus?: string | null
  createdAt: string
  expiresAt: string
}

export const confessionsApi = {
  getHeroConfession: async (): Promise<{items: HeroConfession[], isFallback: boolean}> => {
    try {
      return await client.get('/community/confessions/hero')
    } catch {
      return { items: [], isFallback: false }
    }
  },
}
