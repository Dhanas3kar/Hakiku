import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi, type PostItem, type PostVisibility } from '../../api/posts'
import { FormattedContent } from '@/components/ui/FormattedContent'
import { useAuth } from '../../hooks/useAuth'
import { Heart, MessageCircle, MoreVertical, Share2, Globe, Users, Lock, Trash2, Edit2, Flag } from 'lucide-react'
import { CommentsSection } from './CommentsSection'
import { ReportDialog } from '../community/ReportDialog'
import { PollCard } from '../community/PollCard'
import { toast } from 'sonner'
import { VerifiedBadge } from '../ui/VerifiedBadge'

interface PostCardProps {
  post: PostItem
  onEdit?: (post: PostItem) => void
  onMediaClick?: (media: any[], startIndex: number) => void
}

const VISIBILITY_ICONS: Record<PostVisibility, React.ElementType> = {
  PUBLIC: Globe,
  CONNECTIONS_ONLY: Users,
  PRIVATE: Lock,
}

const VISIBILITY_LABELS: Record<PostVisibility, string> = {
  PUBLIC: 'Public',
  CONNECTIONS_ONLY: 'Connections',
  PRIVATE: 'Only Me',
}

export function PostCard({ post, onEdit, onMediaClick }: PostCardProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showComments, setShowComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const isOwner = (user?.userId || user?.id) === post.authorId
  const VisibilityIcon = VISIBILITY_ICONS[post.visibility] || Globe

  const likeMutation = useMutation({
    mutationFn: (liked: boolean) => (liked ? postsApi.likePost(post.id) : postsApi.unlikePost(post.id)),
    onMutate: async (liked) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] })
      const previousQueries = queryClient.getQueriesData({ queryKey: ['feed'] })
      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old || !old.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: (page.items || []).map((p: PostItem) => {
              if (p.id === post.id) {
                return {
                  ...p,
                  isLikedByViewer: liked,
                  likesCount: liked ? p.likesCount + 1 : p.likesCount - 1,
                }
              }
              return p
            }),
          })),
        }
      })
      return { previousQueries }
    },
    onError: (_err, _newLike, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error(_err.message || 'Failed to like post')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => postsApi.deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete post')
    },
  })

  const handleLikeClick = () => {
    likeMutation.mutate(!post.isLikedByViewer)
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      deleteMutation.mutate()
    }
  }

  const authorName = post.author?.displayName || post.author?.fullName || 'Unknown User'
  const authorUsername = post.author?.username || 'unknown'
  const avatarUrl = post.author?.avatarUrl
  const department = post.author?.department
  const initial = authorName.charAt(0).toUpperCase()

  return (
    <article className="mb-0 sm:mb-4 rounded-none sm:rounded-xl border-b sm:border border-border bg-surface-elevated shadow-none sm:shadow-sm dark:shadow-none overflow-hidden transition-colors">
      <div className="p-4 sm:p-5">
        {/* Header – perfectly aligned avatar + meta + menu */}
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-muted border border-border">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={authorName}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted">
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground text-sm sm:text-base leading-tight truncate max-w-[160px] sm:max-w-none">
                {authorName}
              </span>
              {post.author?.isVerifiedIdentity && <VerifiedBadge />}
              <span className="text-xs text-foreground-muted truncate">@{authorUsername}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground-muted flex-wrap">
              <time dateTime={post.createdAt}>
                {new Date(post.createdAt).toLocaleDateString()}
              </time>
              <span aria-hidden="true">·</span>
              <span
                className="inline-flex items-center gap-1"
                title={VISIBILITY_LABELS[post.visibility] || 'Public'}
              >
                <VisibilityIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="sr-only">{VISIBILITY_LABELS[post.visibility] || 'Public'}</span>
              </span>
              {department && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-[120px] sm:max-w-[180px]">{department}</span>
                </>
              )}
            </div>
          </div>

          {/* Menu — right-aligned dropdown, clamped so it never overflows left edge */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-full text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
              aria-label="More options"
              aria-expanded={showMenu}
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface shadow-md py-1 z-10">
                {isOwner ? (
                  <>
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        onEdit?.(post)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-surface-muted transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit Post
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        handleDelete()
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-surface-muted transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setReportOpen(true)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-surface-muted transition-colors"
                  >
                    <Flag className="h-4 w-4" />
                    Report
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {post.content && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            <FormattedContent content={post.content} />
          </p>
        )}

        {/* Media Grid */}
        {post.media && post.media.length > 0 && (
          <div
            className={`mt-3 -mx-4 sm:mx-0 grid gap-0.5 sm:gap-1 overflow-hidden sm:rounded-xl border-y sm:border border-border dark:border-transparent bg-surface-muted ${post.media.length === 1
                ? 'grid-cols-1'
                : post.media.length === 2
                  ? 'grid-cols-2 aspect-video'
                  : 'grid-cols-2 grid-rows-2 aspect-square'
              }`}
          >
            {(post.media ?? []).slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                onClick={() => onMediaClick?.(post.media ?? [], i)}
                className={`relative cursor-pointer overflow-hidden group ${post.media!.length === 3 && i === 0 ? 'row-span-2' : ''
                  }`}
              >
                {m.type === 'VIDEO' ? (
                  <video src={m.url} className="h-full w-full object-cover" />
                ) : (
                  <img
                    src={m.url}
                    alt="Post media"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
                {post.media!.length > 4 && i === 3 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-xl font-bold">+{post.media!.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Embedded Poll */}
        {(post as any).poll && (
          <div className="mt-3">
            <PollCard poll={(post as any).poll} />
          </div>
        )}
      </div>

      {/* Actions – single perfectly aligned row */}
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 bg-surface-muted/30">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={handleLikeClick}
            disabled={likeMutation.isPending}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all ${post.isLikedByViewer
                ? 'text-primary'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted active:scale-95'
              }`}
            aria-pressed={post.isLikedByViewer}
          >
            <Heart className={`h-4 w-4 ${post.isLikedByViewer ? 'fill-current' : ''}`} />
            <span>{post.likesCount > 0 ? post.likesCount : 'Like'}</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-all active:scale-95"
            aria-expanded={showComments}
          >
            <MessageCircle className="h-4 w-4" />
            <span>{post.commentsCount > 0 ? post.commentsCount : 'Comment'}</span>
          </button>
        </div>

        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-all active:scale-95"
          aria-label="Share post"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-border/60 bg-surface-muted/10 p-4">
          <CommentsSection postId={post.id} />
        </div>
      )}

      <ReportDialog
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetId={post.id}
        targetType="POST"
      />
    </article>
  )
}