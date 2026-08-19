import { client } from './client'

// --- Types ---

export interface Confession {
  id: string
  content: string
  campus: string | null
  createdAt?: string
  publishedAt?: string
  isAuthor?: boolean
  _count?: {
    comments?: number
  }
}

export interface Recommendation {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  headline: string | null
  campus: string | null
  score: number
  reasons: string[]
}

export interface PulseStat {
  id: string
  category: string
  metric: string
  value: number | string
  trend: 'up' | 'down' | 'flat' | null
  trendValue: number | null
  updatedAt: string
}

export interface InsightsData {
  campus: string
  department: string | null
  batchYear: number | null
  newStudentsThisMonth: number | null
  lastUpdated: string
}

export interface PollOption {
  id: string
  text: string
  voteCount: number
}

export interface Poll {
  id: string
  question: string
  isMultipleChoice: boolean
  campus: string | null
  createdAt: string
  expiresAt: string | null
  isActive: boolean
  authorId: string
  options: PollOption[]
  userVotedOptionIds: string[] // Options the current user voted for
}

export interface PaginatedResponse<T> {
  items: T[]
  nextCursorAt?: string
  total?: number
}

// --- API Methods ---

export const communityApi = {
  // Confessions
  getHeroConfession: async (): Promise<Confession | null> => {
    try {
      const res = await client.get<Confession>('/community/confessions/hero')
      return res
    } catch (err: any) {
      if (err.response?.status === 404) return null
      throw err
    }
  },

  submitConfession: async (content: string, campus?: string): Promise<Confession> => {
    const res = await client.post<Confession>('/community/confessions', { content, campus })
    return res
  },

  listConfessions: async (params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<Confession>> => {
    const res = await client.get<any>('/community/confessions', { params })
    if (Array.isArray(res)) {
      return { items: res, nextCursorAt: undefined }
    }
    return res
  },

  deleteConfession: async (id: string): Promise<void> => {
    await client.delete(`/community/confessions/${id}`)
  },

  // People Worth Knowing
  getRecommendations: async (params?: { cursor?: string; limit?: number }): Promise<PaginatedResponse<Recommendation>> => {
    const res = await client.get<any>('/community/people/recommendations', { params })
    if (Array.isArray(res)) {
      return { items: res }
    }
    // Backend may return { items, nextCursor } or { recommendations, nextCursor }
    if (res.items) return { items: res.items, nextCursorAt: res.nextCursor }
    if (res.recommendations) return { items: res.recommendations, nextCursorAt: res.nextCursor }
    return { items: [] }
  },

  // Campus Pulse & Insights
  getPulse: async (): Promise<PulseStat[]> => {
    const res = await client.get<any>('/community/campus/pulse')
    return [
      {
        id: 'posts',
        category: 'Posts (48h)',
        metric: 'Posts',
        value: res.activePosts || 0,
        trend: 'up',
        trendValue: null,
        updatedAt: res.lastUpdated
      },
      {
        id: 'comments',
        category: 'Comments (48h)',
        metric: 'Comments',
        value: res.activeComments || 0,
        trend: 'up',
        trendValue: null,
        updatedAt: res.lastUpdated
      },
      {
        id: 'connections',
        category: 'Connections (48h)',
        metric: 'Connections',
        value: res.newConnections || 0,
        trend: 'up',
        trendValue: null,
        updatedAt: res.lastUpdated
      }
    ]
  },

  getInsights: async (): Promise<InsightsData | null> => {
    try {
      const res = await client.get<InsightsData>('/community/campus/insights')
      return res
    } catch (err: any) {
      if (err.response?.status === 404) return null
      throw err
    }
  },

  // Polls
  createPoll: async (data: { question: string; options: string[]; isMultipleChoice?: boolean; campus?: string }): Promise<Poll> => {
    const res = await client.post<Poll>('/community/polls', data)
    return res
  },

  listPolls: async (params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<Poll>> => {
    const res = await client.get<any>('/community/polls', { params })
    if (Array.isArray(res)) {
      return { items: res.filter(Boolean) }
    }
    if (res.items) return { ...res, items: res.items.filter(Boolean) }
    return { items: [] }
  },

  getPoll: async (id: string): Promise<Poll> => {
    const res = await client.get<Poll>(`/community/polls/${id}`)
    return res
  },

  votePoll: async (id: string, optionId: string): Promise<void> => {
    await client.post(`/community/polls/${id}/vote`, { optionId })
  },

  removeVote: async (id: string, optionId?: string): Promise<void> => {
    await client.delete(`/community/polls/${id}/vote`, { data: { optionId } })
  },

  // Reporting
  reportContent: async (data: { targetType: 'CONFESSION' | 'POLL' | 'POST' | 'COMMENT' | 'USER'; targetId: string; reason: string }): Promise<void> => {
    await client.post('/community/report', data)
  }
}
