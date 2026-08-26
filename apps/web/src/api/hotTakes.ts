import { client } from './client'

export interface HotTake {
  id: string
  content: string
  date?: string | null
  place?: string | null
  time?: string | null
  media?: string | null
  otherDetails?: string | null
  createdAt: string
  author: {
    id: string
    displayName: string
    username: string
    avatarUrl: string | null
  }
}

export const hotTakesApi = {
  createHotTake: async (data: {
    content: string
    date?: string
    place?: string
    time?: string
    media?: string
    otherDetails?: string
  }): Promise<HotTake> => {
    return client.post('/community/hot-takes', data)
  },
  
  getHotTakes: async ({ limit = 20, cursor = 0 }: { limit?: number; cursor?: number }): Promise<{ items: HotTake[], nextOffset: number | null }> => {
    return client.get('/community/hot-takes', {
      params: {
        limit,
        offset: cursor,
      },
    })
  },

  deleteHotTake: async (id: string): Promise<void> => {
    return client.delete(`/community/hot-takes/${id}`)
  },

  updateHotTake: async (id: string, data: { 
    content: string, 
    date?: string, 
    place?: string, 
    time?: string, 
    media?: string, 
    otherDetails?: string 
  }): Promise<HotTake> => {
    return client.patch(`/community/hot-takes/${id}`, data)
  },
}
