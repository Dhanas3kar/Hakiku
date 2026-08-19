import { client } from './client'
import type { PostItem } from './posts'

export interface FeedResponse {
  items: PostItem[]
  nextCursor: string | null
}

export const feedApi = {
  getPersonalizedFeed: (params?: { cursor?: string; limit?: number }): Promise<FeedResponse> => {
    const query = new URLSearchParams()
    if (params?.cursor) query.append('cursor', params.cursor)
    if (params?.limit) query.append('limit', params.limit.toString())
    const queryString = query.toString() ? `?${query.toString()}` : ''
    return client.get(`/feed${queryString}`)
  },

  getDiscoveryFeed: (params?: { cursor?: string; limit?: number }): Promise<FeedResponse> => {
    const query = new URLSearchParams()
    if (params?.cursor) query.append('cursor', params.cursor)
    if (params?.limit) query.append('limit', params.limit.toString())
    const queryString = query.toString() ? `?${query.toString()}` : ''
    return client.get(`/feed/discover${queryString}`)
  },
}
