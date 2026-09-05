import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi, type PostComment } from '../../api/posts'
import { useAuth } from '../../hooks/useAuth'
import { Flag, Send, Heart, Reply, Trash2, X } from 'lucide-react'
import { ReportDialog } from '../community/ReportDialog'
import { VerifiedBadge } from '../ui/VerifiedBadge'
import { isUserVerified } from '@/utils/user'
import { FormattedContent } from '@/components/ui/FormattedContent'
import { MentionTextarea } from '@/components/ui/MentionTextarea'
import { toast } from 'sonner'

interface CommentsSectionProps {
  postId: string
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorName: string } | null>(null)
  const [reportOpenId, setReportOpenId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => postsApi.getComments(postId),
  })

  // Add Comment / Reply Mutation
  const addCommentMutation = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId?: string }) =>
      postsApi.createComment(postId, text, parentId),
    onSuccess: () => {
      setContent('')
      setReplyingTo(null)
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
      // Increment comment count on feed query optimistically
      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old || !old.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: (page.items || []).map((p: any) => {
              if (p.id === postId) {
                return { ...p, commentsCount: (p.commentsCount || 0) + 1 }
              }
              return p
            }),
          })),
        }
      })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add comment')
    },
  })

  // Toggle Comment Like Mutation
  const toggleLikeMutation = useMutation({
    mutationFn: (commentId: string) => postsApi.toggleCommentLike(commentId),
    onMutate: async (commentId: string) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] })
      const previousData = queryClient.getQueryData(['comments', postId])

      queryClient.setQueryData(['comments', postId], (old: any) => {
        if (!old || !old.items) return old
        return {
          ...old,
          items: old.items.map((c: PostComment) => {
            if (c.id === commentId) {
              const currentlyLiked = c.isLikedByViewer || false
              const currentLikes = c.likesCount || 0
              return {
                ...c,
                isLikedByViewer: !currentlyLiked,
                likesCount: currentlyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1,
              }
            }
            return c
          }),
        }
      })

      return { previousData }
    },
    onError: (err: any, _commentId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['comments', postId], context.previousData)
      }
      toast.error(err.message || 'Failed to update like')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
    },
  })

  // Delete Comment Mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => postsApi.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old || !old.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: (page.items || []).map((p: any) => {
              if (p.id === postId) {
                return { ...p, commentsCount: Math.max(0, (p.commentsCount || 0) - 1) }
              }
              return p
            }),
          })),
        }
      })
      toast.success('Comment deleted')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete comment')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || addCommentMutation.isPending) return
    addCommentMutation.mutate({
      text: content.trim(),
      parentId: replyingTo?.commentId,
    })
  }

  const handleStartReply = (commentId: string, authorName: string) => {
    setReplyingTo({ commentId, authorName })
    if (!content.includes(`@${authorName}`)) {
      setContent((prev) => `@${authorName} ${prev}`.trim())
    }
  }

  if (isLoading) {
    return <div className="text-sm text-foreground-muted animate-pulse py-2">Loading comments...</div>
  }

  if (isError) {
    return <div className="text-sm text-danger py-2">Failed to load comments</div>
  }

  const allComments: PostComment[] = data?.items || []

  // Group top-level comments and child replies
  const topLevelComments = allComments.filter((c) => !c.parentId)
  const repliesByParentId = allComments.reduce((acc, comment) => {
    if (comment.parentId) {
      if (!acc[comment.parentId]) acc[comment.parentId] = []
      acc[comment.parentId].push(comment)
    }
    return acc
  }, {} as Record<string, PostComment[]>)

  const isCurrentCreator = (comment: PostComment) => {
    const currentUserId = user?.id || user?.userId
    return (
      currentUserId &&
      (currentUserId === comment.authorId || currentUserId === comment.author?.userId)
    )
  }

  const renderComment = (comment: PostComment, isReply = false) => {
    const authorName = comment.author?.displayName || comment.author?.fullName || 'Campus Member'
    const avatarUrl = comment.author?.avatarUrl
    const initial = authorName.charAt(0).toUpperCase()
    const isOwner = isCurrentCreator(comment)

    return (
      <div key={comment.id} className={`group/comment flex gap-2.5 ${isReply ? 'mt-2.5' : 'mt-3.5'}`}>
        <div className="h-7 w-7 overflow-hidden rounded-full bg-surface-muted border border-border shrink-0 mt-0.5">
          {avatarUrl ? (
            <img src={avatarUrl} alt={authorName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted text-[11px]">
              {initial}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-surface-muted/70 dark:bg-surface-muted/40 rounded-2xl rounded-tl-none px-3.5 py-2 border border-border/60">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-semibold text-xs sm:text-sm text-foreground truncate">{authorName}</span>
                {isUserVerified(comment.author) && <VerifiedBadge />}
              </div>
              <time className="text-[11px] text-foreground-muted whitespace-nowrap shrink-0">
                {new Date(comment.createdAt).toLocaleDateString()}
              </time>
            </div>
            <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
              <FormattedContent content={comment.content} />
            </p>
          </div>

          {/* Action Row: Like, Reply, Delete / Report */}
          <div className="flex items-center gap-3.5 px-2 mt-1 text-[11px] font-medium text-foreground-muted">
            {/* Like Comment Button */}
            <button
              type="button"
              onClick={() => toggleLikeMutation.mutate(comment.id)}
              className={`flex items-center gap-1 hover:text-rose-500 transition-colors ${
                comment.isLikedByViewer ? 'text-rose-500 font-semibold' : ''
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${comment.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{comment.likesCount && comment.likesCount > 0 ? comment.likesCount : 'Like'}</span>
            </button>

            {/* Reply Button */}
            <button
              type="button"
              onClick={() => handleStartReply(comment.id, authorName)}
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Reply className="h-3.5 w-3.5" />
              <span>Reply</span>
            </button>

            {/* Delete for Comment Creator */}
            {isOwner ? (
              <button
                type="button"
                onClick={() => {
                  toast('Delete this comment?', {
                    action: {
                      label: 'Delete',
                      onClick: () => deleteCommentMutation.mutate(comment.id),
                    },
                    cancel: {
                      label: 'Cancel',
                      onClick: () => {},
                    },
                  })
                }}
                className="flex items-center gap-1 text-danger/80 hover:text-danger transition-colors ml-auto"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setReportOpenId(comment.id)}
                className="flex items-center gap-1 hover:text-danger transition-colors ml-auto"
              >
                <Flag className="h-3 w-3" />
                <span>Report</span>
              </button>
            )}
          </div>

          {/* Render Child Replies */}
          {repliesByParentId[comment.id] && repliesByParentId[comment.id].length > 0 && (
            <div className="pl-4 border-l-2 border-border/40 mt-1 space-y-2">
              {repliesByParentId[comment.id].map((childReply) => renderComment(childReply, true))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-1">
      {/* Replying Banner Header */}
      {replyingTo && (
        <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-1.5 text-xs text-primary border border-primary/20">
          <span>Replying to <strong className="font-semibold">@{replyingTo.authorName}</strong></span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-0.5 hover:bg-primary/20 rounded-full transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Comment / Reply Input Form */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="h-8 w-8 overflow-hidden rounded-full bg-surface-muted border border-border shrink-0">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName || user.fullName || ''} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted text-xs">
              {(user?.displayName || user?.fullName || '?').charAt(0)}
            </div>
          )}
        </div>
        <div className="relative flex-1">
          <MentionTextarea
            rows={1}
            value={content}
            onChangeValue={setContent}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder={replyingTo ? `Reply to @${replyingTo.authorName}...` : "Write a comment... Type @ to tag someone"}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-2 text-xs sm:text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10 transition-colors resize-none"
            containerClassName="w-full"
            disabled={addCommentMutation.isPending}
          />
          <button
            type="submit"
            disabled={!content.trim() || addCommentMutation.isPending}
            className="absolute right-2 bottom-2 p-1.5 text-primary disabled:text-foreground-muted hover:bg-surface-muted rounded-full transition-colors z-10"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-1">
        {topLevelComments.map((comment) => renderComment(comment))}

        {allComments.length === 0 && (
          <div className="text-center py-4 text-xs sm:text-sm text-foreground-muted">
            No comments yet. Be the first to start the conversation!
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
