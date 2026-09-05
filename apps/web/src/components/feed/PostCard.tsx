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
import { isUserVerified } from '@/utils/user'
import { Avatar } from '../ui/Avatar'

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
  CONNECTIONS_ONLY: 'Connections only',
  PRIVATE: 'Only me',
}

function PostContent({ content }: { content: string }) {
  return (
    <div className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
      <FormattedContent content={content} />
    </div>
  )
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
    toast('Are you sure you want to delete this post?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete',
        onClick: () => deleteMutation.mutate(),
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
    })
  }

  const author = post.author || ((user?.userId || user?.id) === post.authorId ? {
    displayName: user?.displayName,
    username: user?.username,
    avatarUrl: user?.avatarUrl,
  } : null)

  const authorName = author?.displayName || author?.fullName || 'Unknown User'
  const authorUsername = author?.username || 'unknown'
  const avatarUrl = author?.avatarUrl
  const department = author?.department

  return (
    <article className="border-b border-border-subtle bg-surface sm:bg-transparent">
      <div className="px-4 py-5 sm:px-1 sm:py-6">
        {/* Header – perfectly aligned avatar + meta + menu */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar src={avatarUrl} alt={authorName} name={authorName} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground text-[15px] leading-tight truncate max-w-[160px] sm:max-w-none">
                {authorName}
              </span>
              {isUserVerified(post.author) && <VerifiedBadge />}
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
              <div className="absolute right-0 top-full mt-1 w-48 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-surface shadow-md py-1 z-10">
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
        {post.content && <PostContent content={post.content} />}

        {/* Media Grid */}
        {post.media && post.media.length > 0 && (
          <div
            className={`mt-3.5 -mx-4 sm:mx-0 overflow-hidden sm:rounded-xl border-y sm:border border-border-subtle bg-surface-muted/40 ${
              post.media.length === 1
                ? 'flex items-center justify-center bg-black/5 dark:bg-black/40 rounded-xl overflow-hidden'
                : post.media.length === 2
                  ? 'grid grid-cols-2 gap-1 rounded-xl overflow-hidden'
                  : 'grid grid-cols-2 grid-rows-2 gap-1 rounded-xl overflow-hidden'
            }`}
          >
            {(post.media ?? []).slice(0, 4).map((m, i) => (
              <div
                key={m.id || i}
                onClick={() => onMediaClick?.(post.media ?? [], i)}
                className={`relative cursor-pointer overflow-hidden group ${
                  post.media!.length === 1
                    ? 'w-full flex justify-center items-center'
                    : post.media!.length === 3 && i === 0
                      ? 'row-span-2 h-full'
                      : 'h-full min-h-[160px]'
                }`}
              >
                {m.type === 'VIDEO' ? (
                  <video
                    src={m.url}
                    controls
                    className={
                      post.media!.length === 1
                        ? 'w-full max-h-[650px] object-contain rounded-xl'
                        : 'w-full h-full object-cover rounded-md'
                    }
                  />
                ) : (
                  <img
                    src={m.url}
                    alt="Post media"
                    loading="lazy"
                    decoding="async"
                    className={
                      post.media!.length === 1
                        ? 'w-full h-auto max-h-[700px] object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]'
                        : 'w-full h-full object-cover rounded-md transition-transform duration-300 group-hover:scale-[1.02]'
                    }
                  />
                )}
                {post.media!.length > 4 && i === 3 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-md">
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
            <PollCard poll={(post as any).poll} hideQuestion={true} />
          </div>
        )}
      </div>

      {/* Actions – single perfectly aligned row */}
      <div className="flex items-center justify-between px-4 pb-4 sm:px-1 sm:pb-5">
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
        <div className="px-4 pb-5 sm:px-1">
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