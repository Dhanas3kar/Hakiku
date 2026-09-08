import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi, type PostComment } from '../../api/posts'
import { useAuth } from '../../hooks/useAuth'
import { Flag, Send, Heart, Reply, Trash2, X } from 'lucide-react'
import { ReportDialog } from '../community/ReportDialog'
import { VerifiedBadge } from '../ui/VerifiedBadge'
import { isUserVerified } from '@/utils/user'
import { FormattedContent } from '@/components/ui/FormattedContent'
import { MentionTextarea } from '@/components/ui/MentionTextarea'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

interface CommentsSectionProps {
  postId: string
}

/** Recursion guard: max reply nesting we'll actually render even if data is malformed/cyclic */
const MAX_REPLY_DEPTH = 20

function safeDateLabel(value: unknown): string {
  if (!value) return ''
  const d = new Date(value as string)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString()
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorName: string } | null>(null)
  const [reportOpenId, setReportOpenId] = useState<string | null>(null)
  const [pendingLikeId, setPendingLikeId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const textareaWrapperRef = useRef<HTMLDivElement | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => postsApi.getComments(postId),
    enabled: !!postId,
    retry: 2,
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
        if (!old || !Array.isArray(old.pages)) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: (Array.isArray(page?.items) ? page.items : []).map((p: any) => {
              if (p?.id === postId) {
                return { ...p, commentsCount: (p.commentsCount || 0) + 1 }
              }
              return p
            }),
          })),
        }
      })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to add comment')
    },
  })

  // Toggle Comment Like Mutation
  const toggleLikeMutation = useMutation({
    mutationFn: (commentId: string) => postsApi.toggleCommentLike(commentId),
    onMutate: async (commentId: string) => {
      setPendingLikeId(commentId)
      await queryClient.cancelQueries({ queryKey: ['comments', postId] })
      const previousData = queryClient.getQueryData(['comments', postId])

      queryClient.setQueryData(['comments', postId], (old: any) => {
        if (!old || !Array.isArray(old.items)) return old
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
      toast.error(err?.message || 'Failed to update like')
    },
    onSettled: () => {
      setPendingLikeId(null)
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
    },
  })

  // Delete Comment Mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => postsApi.deleteComment(commentId),
    onMutate: async (commentId: string) => {
      setPendingDeleteId(commentId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old || !Array.isArray(old.pages)) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: (Array.isArray(page?.items) ? page.items : []).map((p: any) => {
              if (p?.id === postId) {
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
      toast.error(err?.message || 'Failed to delete comment')
    },
    onSettled: () => {
      setPendingDeleteId(null)
    },
  })

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = content.trim()
      if (!trimmed || addCommentMutation.isPending || !postId) return
      addCommentMutation.mutate({
        text: trimmed,
        parentId: replyingTo?.commentId,
      })
    },
    [content, addCommentMutation, replyingTo, postId],
  )

  const handleStartReply = useCallback((commentId: string, authorName: string) => {
    setReplyingTo({ commentId, authorName })
    setContent((prev) => (prev.includes(`@${authorName}`) ? prev : `@${authorName} ${prev}`.trim()))
    // give focus back to the composer so the user can start typing immediately
    window.setTimeout(() => {
      const el = textareaWrapperRef.current?.querySelector('textarea')
      el?.focus()
    }, 0)
  }, [])

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null)
  }, [])

  // Defensive parsing: tolerate a non-array/malformed payload
  const allComments: PostComment[] = Array.isArray(data?.items)
    ? (data!.items as PostComment[]).filter((c): c is PostComment => !!c && !!c.id)
    : []

  // Group top-level comments and child replies; guard against a comment
  // whose parentId points at itself (would otherwise orphan/duplicate it)
  const { topLevelComments, repliesByParentId } = useMemoGrouping(allComments)

  if (isLoading) {
    return (
      <div className="text-sm text-foreground-muted animate-pulse py-2" aria-busy="true">
        Loading comments...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between text-sm text-danger py-2 gap-3">
        <span>Failed to load comments</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs font-semibold underline underline-offset-2 hover:text-danger/80"
        >
          Retry
        </button>
      </div>
    )
  }

  const isCurrentCreator = (comment: PostComment) => {
    const currentUserId = user?.id || user?.userId
    return (
      !!currentUserId &&
      (currentUserId === comment.authorId || currentUserId === comment.author?.userId)
    )
  }

  const renderComment = (comment: PostComment, isReply = false, depth = 0, ancestry: Set<string> = new Set()) => {
    // Cyclic-data / runaway-depth guard: never recurse past a sane limit,
    // and never re-render a comment that's already an ancestor of itself.
    if (depth > MAX_REPLY_DEPTH || ancestry.has(comment.id)) return null

    const authorName = comment.author?.displayName || comment.author?.fullName || 'Campus Member'
    const avatarUrl = comment.author?.avatarUrl
    const username = comment.author?.username
    const initial = authorName.trim().charAt(0).toUpperCase() || '?'
    const isOwner = isCurrentCreator(comment)
    const dateLabel = safeDateLabel(comment.createdAt)
    const isLikePending = toggleLikeMutation.isPending && pendingLikeId === comment.id
    const isDeletePending = deleteCommentMutation.isPending && pendingDeleteId === comment.id
    const replies = repliesByParentId[comment.id] || []
    const nextAncestry = new Set(ancestry)
    nextAncestry.add(comment.id)

    const AuthorLink = ({ children, className }: { children: React.ReactNode; className?: string }) =>
      username ? (
        <Link
          to="/profile/$username"
          params={{ username }}
          onClick={(e) => e.stopPropagation()}
          className={className}
        >
          {children}
        </Link>
      ) : (
        <span className={className}>{children}</span>
      )

    return (
      <div key={comment.id} className={`group/comment flex gap-2.5 ${isReply ? 'mt-2.5' : 'mt-3.5'}`}>
        <AuthorLink className="h-7 w-7 overflow-hidden rounded-full bg-surface-muted border border-border shrink-0 mt-0.5 cursor-pointer block">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={authorName}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={(e) => {
                ; (e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted text-[11px]">
              {initial}
            </div>
          )}
        </AuthorLink>

        <div className="flex-1 min-w-0">
          <div className="bg-surface-muted/70 dark:bg-surface-muted/40 rounded-2xl rounded-tl-none px-3.5 py-2 border border-border/60">
            <div className="flex items-center justify-between gap-2 mb-1">
              <AuthorLink className="flex items-center gap-1.5 truncate group cursor-pointer">
                <span className="font-semibold text-xs sm:text-sm text-foreground truncate group-hover:underline">
                  {authorName}
                </span>
                {isUserVerified(comment.author) && <VerifiedBadge />}
              </AuthorLink>
              {dateLabel && (
                <time className="text-[11px] text-foreground-muted whitespace-nowrap shrink-0">{dateLabel}</time>
              )}
            </div>
            <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
              <FormattedContent content={comment.content ?? ''} />
            </p>
          </div>

          {/* Action Row: Like, Reply, Delete / Report */}
          <div className="flex items-center gap-3.5 px-2 mt-1 text-[11px] font-medium text-foreground-muted">
            {/* Like Comment Button */}
            <button
              type="button"
              disabled={isLikePending}
              onClick={() => {
                if (!isLikePending) toggleLikeMutation.mutate(comment.id)
              }}
              className={`flex items-center gap-1 hover:text-rose-500 transition-colors disabled:opacity-60 disabled:cursor-wait ${comment.isLikedByViewer ? 'text-rose-500 font-semibold' : ''
                }`}
              aria-pressed={!!comment.isLikedByViewer}
              aria-label={comment.isLikedByViewer ? 'Unlike comment' : 'Like comment'}
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
                disabled={isDeletePending}
                onClick={() => {
                  toast('Delete this comment?', {
                    action: {
                      label: 'Delete',
                      onClick: () => deleteCommentMutation.mutate(comment.id),
                    },
                    cancel: {
                      label: 'Cancel',
                      onClick: () => { },
                    },
                  })
                }}
                className="flex items-center gap-1 text-danger/80 hover:text-danger transition-colors ml-auto disabled:opacity-60 disabled:cursor-wait"
              >
                <Trash2 className="h-3 w-3" />
                <span>{isDeletePending ? 'Deleting…' : 'Delete'}</span>
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
          {replies.length > 0 && (
            <div className="pl-4 border-l-2 border-border/40 mt-1 space-y-2">
              {replies.map((childReply) => renderComment(childReply, true, depth + 1, nextAncestry))}
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
          <span>
            Replying to <strong className="font-semibold">@{replyingTo.authorName}</strong>
          </span>
          <button
            type="button"
            onClick={handleCancelReply}
            className="p-0.5 hover:bg-primary/20 rounded-full transition-colors"
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Comment / Reply Input Form */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="h-8 w-8 overflow-hidden rounded-full bg-surface-muted border border-border shrink-0">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName || user.fullName || ''}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={(e) => {
                ; (e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted text-xs">
              {(user?.displayName || user?.fullName || '?').trim().charAt(0) || '?'}
            </div>
          )}
        </div>
        <div className="relative flex-1" ref={textareaWrapperRef}>
          <MentionTextarea
            rows={1}
            value={content}
            onChangeValue={setContent}
            onKeyDown={(e) => {
              // Don't submit while an IME composition (e.g. Japanese/Chinese/Korean input) is in progress
              const isComposing = (e.nativeEvent as any)?.isComposing || (e as any).keyCode === 229
              if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                e.preventDefault()
                handleSubmit(e as unknown as React.FormEvent)
              }
            }}
            placeholder={
              replyingTo ? `Reply to @${replyingTo.authorName}...` : 'Write a comment... Type @ to tag someone'
            }
            className="w-full rounded-2xl border border-border bg-surface px-4 py-2 text-xs sm:text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-10 transition-colors resize-none"
            containerClassName="w-full"
            disabled={addCommentMutation.isPending}
          />
          <button
            type="submit"
            disabled={!content.trim() || addCommentMutation.isPending}
            className="absolute right-2 bottom-2 p-1.5 text-primary disabled:text-foreground-muted hover:bg-surface-muted rounded-full transition-colors z-10"
            aria-label="Post comment"
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

/**
 * Groups comments into top-level + replies-by-parent, guarding against:
 * - a comment whose parentId is its own id (self-cycle)
 * - a parentId that doesn't resolve to any known comment (orphan reply,
 *   silently dropped from the tree rather than crashing)
 */
function useMemoGrouping(allComments: PostComment[]) {
  return useMemo(() => {
    const knownIds = new Set(allComments.map((c) => c.id))
    const topLevelComments: PostComment[] = []
    const repliesByParentId: Record<string, PostComment[]> = {}

    for (const comment of allComments) {
      const parentId = comment.parentId
      const hasValidParent = !!parentId && parentId !== comment.id && knownIds.has(parentId)

      if (!hasValidParent) {
        topLevelComments.push(comment)
        continue
      }
      if (!repliesByParentId[parentId]) repliesByParentId[parentId] = []
      repliesByParentId[parentId].push(comment)
    }

    return { topLevelComments, repliesByParentId }
  }, [allComments])
}