import { client } from './client'
import type { PostItem } from './posts'

export interface FeedResponse {
  items: PostItem[]
  nextCursor: string | null
}

export const feedApi = {
  getPersonalizedFeed: async (params?: { cursor?: string; limit?: number }): Promise<FeedResponse> => {
    const res = await client.get(`/feed`, { params })
    return {
      items: res.data || [],
      nextCursor: res.pagination?.nextCursor || null
    }
  },

  getDiscoveryFeed: async (params?: { cursor?: string; limit?: number }): Promise<FeedResponse> => {
    const res = await client.get(`/feed/discover`, { params })
    return {
      items: res.data || [],
      nextCursor: res.pagination?.nextCursor || null
    }
  },
}
