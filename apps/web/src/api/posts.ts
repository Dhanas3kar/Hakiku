import { client } from './client'

export type PostVisibility = 'PUBLIC' | 'CONNECTIONS_ONLY' | 'PRIVATE'

export interface PostMedia {
  id: string
  url: string
  type: 'IMAGE' | 'VIDEO'
  aspectRatio?: number
}

export interface PostAuthor {
  id: string
  userId: string
  username: string
  displayName: string
  fullName?: string // alias for backward compat
  avatarUrl: string | null
  department: string | null
  batch: string | null
  isVerifiedIdentity?: boolean
}

export interface PostItem {
  id: string
  authorId: string
  content: string | null
  visibility: PostVisibility
  likeCount: number
  commentCount: number
  isLiked: boolean
  createdAt: string
  updatedAt: string
  author: PostAuthor
  media: PostMedia[]
}

export interface PostComment {
  id: string
  postId: string
  authorId: string
  content: string
  createdAt: string
  updatedAt: string
  author: PostAuthor
}

export interface CommentsResponse {
  items: PostComment[]
  nextCursor: string | null
}

export interface CreatePostPayload {
  content?: string
  visibility?: PostVisibility
  mediaUploadIds?: string[]
  pollId?: string
}

export interface UpdatePostPayload {
  content?: string
  visibility?: PostVisibility
}

export interface UserPostsResponse {
  items: PostItem[]
  nextCursor: string | null
}

export const postsApi = {
  createPost: (payload: CreatePostPayload): Promise<PostItem> => client.post('/posts', payload),
  
  uploadMedia: (file: File): Promise<PostMedia> => {
    return client.post('/posts/media/upload', file, {
      headers: {
        'Content-Type': file.type,
      },
    })
  },

  getPost: (id: string): Promise<PostItem> => client.get(`/posts/${id}`),

  updatePost: (id: string, payload: UpdatePostPayload): Promise<PostItem> => client.patch(`/posts/${id}`, payload),

  deletePost: (id: string): Promise<{ message: string }> => client.delete(`/posts/${id}`),

  likePost: (id: string): Promise<{ success: boolean; likeCount: number }> => client.post(`/posts/${id}/like`),

  unlikePost: (id: string): Promise<{ success: boolean; likeCount: number }> => client.delete(`/posts/${id}/like`),

  getComments: async (postId: string, params?: { cursor?: string; limit?: number }): Promise<CommentsResponse> => {
    const res = await client.get(`/posts/${postId}/comments`, { params })
    return {
      items: res.data || [],
      nextCursor: res.meta?.nextCursor || null
    }
  },

  createComment: (postId: string, content: string): Promise<PostComment> => client.post(`/posts/${postId}/comments`, { content }),

  updateComment: (commentId: string, content: string): Promise<PostComment> => client.patch(`/posts/comments/${commentId}`, { content }),

  deleteComment: (commentId: string): Promise<{ message: string }> => client.delete(`/posts/comments/${commentId}`),

  getUserPosts: async (userId: string, params?: { cursor?: string; limit?: number }): Promise<UserPostsResponse> => {
    const res = await client.get(`/posts/user/${userId}`, { params })
    return {
      items: res.data || [],
      nextCursor: res.meta?.nextCursor || null
    }
  },
}
