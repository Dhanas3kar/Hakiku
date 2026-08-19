import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi } from '../../api/posts'
import { useAuth } from '../../hooks/useAuth'
import { Trash2, Send, Flag } from 'lucide-react'
import { ReportDialog } from '../community/ReportDialog'

interface CommentsSectionProps {
  postId: string
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [reportOpenId, setReportOpenId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => postsApi.getComments(postId),
  })

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => postsApi.createComment(postId, text),
    onSuccess: () => {
      setContent('')
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
      // Update the post's comment count optimistically
      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old || !old.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((p: any) => {
              if (p.id === postId) {
                return { ...p, commentCount: p.commentCount + 1 }
              }
              return p
            }),
          })),
        }
      })
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => postsApi.deleteComment(postId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
      // Update the post's comment count optimistically
      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old || !old.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((p: any) => {
              if (p.id === postId) {
                return { ...p, commentCount: Math.max(0, p.commentCount - 1) }
              }
              return p
            }),
          })),
        }
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || addCommentMutation.isPending) return
    addCommentMutation.mutate(content.trim())
  }

  if (isLoading) {
    return <div className="text-sm text-foreground-muted animate-pulse py-2">Loading comments...</div>
  }

  if (isError) {
    return <div className="text-sm text-danger py-2">Failed to load comments</div>
  }

  const comments = data?.items || []

  return (
    <div className="space-y-4">
      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="h-8 w-8 overflow-hidden rounded-full bg-surface-muted border border-border shrink-0">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName || user.fullName || ''} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted text-xs">
              {(user?.displayName || user?.fullName || '?').charAt(0)}
            </div>
          )}
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment..."
            className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10 transition-colors"
            disabled={addCommentMutation.isPending}
          />
          <button
            type="submit"
            disabled={!content.trim() || addCommentMutation.isPending}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary disabled:text-foreground-muted hover:bg-surface-muted rounded-full transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-2 group">
            <div className="h-8 w-8 overflow-hidden rounded-full bg-surface-muted border border-border shrink-0 mt-0.5">
              {comment.author.avatarUrl ? (
                <img src={comment.author.avatarUrl} alt={comment.author.displayName || comment.author.fullName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted text-xs">
                  {(comment.author.displayName || comment.author.fullName || '?').charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="rounded-2xl bg-surface p-3 border border-border/50 text-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-foreground">
                    {comment.author.displayName || comment.author.fullName}
                  </span>
                  <span className="text-xs text-foreground-muted shrink-0">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-foreground whitespace-pre-wrap break-words leading-relaxed">{comment.content}</p>
              </div>
              
              {(user?.userId || user?.id) === comment.authorId ? (
                <div className="flex items-center gap-3 px-3 mt-1">
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this comment?')) {
                        deleteCommentMutation.mutate(comment.id)
                      }
                    }}
                    className="text-xs font-medium text-danger/70 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-3 mt-1">
                  <button
                    onClick={() => setReportOpenId(comment.id)}
                    className="flex items-center gap-1 text-xs font-medium text-danger/70 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Flag className="h-3 w-3" />
                    Report
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-center py-4 text-sm text-foreground-muted">
            No comments yet. Be the first!
          </div>
        )}
      </div>

      <ReportDialog 
        isOpen={!!reportOpenId} 
        onClose={() => setReportOpenId(null)} 
        targetId={reportOpenId || ''} 
        targetType="COMMENT" 
      />
    </div>
  )
}
