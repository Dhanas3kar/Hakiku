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
  role?: string
}

export interface PostItem {
  id: string
  authorId: string
  content: string | null
  visibility: PostVisibility
  likesCount: number
  commentsCount: number
  isLikedByViewer: boolean
  createdAt: string
  updatedAt: string
  author: PostAuthor
  media: PostMedia[]
}

export interface PostComment {
  id: string
  postId: string
  parentId?: string | null
  authorId: string
  content: string
  likesCount?: number
  isLikedByViewer?: boolean
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
  idempotencyKey?: string
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
        'Content-Type': 'application/octet-stream',
        'X-File-Type': file.type || 'image/jpeg',
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

  createComment: (postId: string, content: string, parentId?: string): Promise<PostComment> => {
    const body: { content: string; parentId?: string } = { content }
    if (parentId && parentId.trim()) {
      body.parentId = parentId.trim()
    }
    return client.post(`/posts/${postId}/comments`, body)
  },

  toggleCommentLike: (commentId: string): Promise<{ liked: boolean; likesCount: number }> => 
    client.post(`/posts/comments/${commentId}/like`),

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
