import { client } from './client'

export interface HeroConfession {
  id: string
  content: string
  campus?: string | null
  createdAt: string
  expiresAt: string
}

export const confessionsApi = {
  getHeroConfession: async (): Promise<HeroConfession | null> => {
    try {
      return await client.get('/community/confessions/hero')
    } catch {
      return null
    }
  },
}
