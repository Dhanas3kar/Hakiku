import {
  useState,
  useRef,
  useCallback,
  useEffect,
  memo,
  type ElementType,
} from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi, type PostItem, type PostVisibility } from '../../api/posts'
import { FormattedContent } from '@/components/ui/FormattedContent'
import { useAuth } from '../../hooks/useAuth'
import {
  Heart,
  MessageCircle,
  MoreVertical,
  Share2,
  Globe,
  Users,
  Lock,
  Trash2,
  Edit2,
  Flag,
} from 'lucide-react'
import { CommentsSection } from './CommentsSection'
import { ReportDialog } from '../community/ReportDialog'
import { PollCard } from '../community/PollCard'
import { toast } from 'sonner'
import { VerifiedBadge } from '../ui/VerifiedBadge'
import { isUserVerified } from '@/utils/user'
import { Avatar } from '../ui/Avatar'
import { Link } from '@tanstack/react-router'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaItem {
  id?: string
  url: string
  type: 'IMAGE' | 'VIDEO'
}

interface PostCardProps {
  post: PostItem
  onEdit?: (post: PostItem) => void
  onMediaClick?: (media: MediaItem[], startIndex: number) => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VISIBILITY_ICONS: Record<PostVisibility, ElementType> = {
  PUBLIC: Globe,
  CONNECTIONS_ONLY: Users,
  PRIVATE: Lock,
}

const VISIBILITY_LABELS: Record<PostVisibility, string> = {
  PUBLIC: 'Public',
  CONNECTIONS_ONLY: 'Connections only',
  PRIVATE: 'Only me',
}

const DOUBLE_TAP_MS = 300
const HEART_POP_MS = 450
const BURST_MS = 800

// ─── Pure helpers ────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diff = now - date.getTime()

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const PostContent = memo(function PostContent({ content }: { content: string }) {
  return (
    <div className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
      <FormattedContent content={content} />
    </div>
  )
})

// ─── Main component ──────────────────────────────────────────────────────────

function PostCardComponent({ post, onEdit, onMediaClick }: PostCardProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [showComments, setShowComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [isPopping, setIsPopping] = useState(false)
  const [showBurstHeart, setShowBurstHeart] = useState(false)

  const lastTapRef = useRef(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const popTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const isOwner = (user?.userId || user?.id) === post.authorId
  const VisibilityIcon = VISIBILITY_ICONS[post.visibility] ?? Globe

  // ── Author resolution ──────────────────────────────────────────────────────

  const author =
    post.author ??
    ((user?.userId || user?.id) === post.authorId
      ? {
        displayName: user?.displayName,
        fullName: (user as any)?.fullName,
        username: user?.username,
        avatarUrl: user?.avatarUrl,
        department: (user as any)?.department,
      }
      : null)

  const authorName = author?.displayName || author?.fullName || 'Unknown User'
  const authorUsername = author?.username || 'unknown'
  const avatarUrl = author?.avatarUrl
  const department = author?.department

  // ── Cache helpers ──────────────────────────────────────────────────────────

  const updatePostInCache = useCallback(
    (targetPostId: string, updater: (p: PostItem) => PostItem) => {
      queryClient.setQueriesData(
        {
          predicate: (query) => {
            const key = query.queryKey
            if (!Array.isArray(key)) return false
            return (
              key[0] === 'feed' ||
              (key[0] === 'profile' && key[1] === 'posts') ||
              key[0] === 'posts' ||
              (key[0] === 'post' && key[1] === targetPostId) ||
              key[0] === 'community'
            )
          },
        },
        (old: any) => {
          if (!old) return old

          // Infinite query shape
          if (old.pages && Array.isArray(old.pages)) {
            return {
              ...old,
              pages: old.pages.map((page: any) => {
                if (!page?.items || !Array.isArray(page.items)) return page
                return {
                  ...page,
                  items: page.items.map((p: PostItem) =>
                    p.id === targetPostId ? updater(p) : p
                  ),
                }
              }),
            }
          }

          // Single post
          if (old.id === targetPostId) return updater(old)

          // Plain array
          if (Array.isArray(old)) {
            return old.map((p: PostItem) => (p.id === targetPostId ? updater(p) : p))
          }

          return old
        }
      )
    },
    [queryClient]
  )

  // ── Like mutation (optimistic) ─────────────────────────────────────────────

  const likeMutation = useMutation({
    mutationFn: (liked: boolean) =>
      liked ? postsApi.likePost(post.id) : postsApi.unlikePost(post.id),

    onMutate: async (liked) => {
      await queryClient.cancelQueries({
        predicate: (query) => {
          const key = query.queryKey
          return (
            Array.isArray(key) &&
            (key[0] === 'feed' ||
              (key[0] === 'profile' && key[1] === 'posts') ||
              key[0] === 'posts' ||
              (key[0] === 'post' && key[1] === post.id) ||
              key[0] === 'community')
          )
        },
      })

      const previousQueries = queryClient.getQueriesData({
        predicate: (query) => {
          const key = query.queryKey
          return (
            Array.isArray(key) &&
            (key[0] === 'feed' ||
              (key[0] === 'profile' && key[1] === 'posts') ||
              key[0] === 'posts' ||
              (key[0] === 'post' && key[1] === post.id) ||
              key[0] === 'community')
          )
        },
      })

      updatePostInCache(post.id, (p) => ({
        ...p,
        isLikedByViewer: liked,
        likesCount: liked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
      }))

      return { previousQueries }
    },

    onError: (err, _vars, context) => {
      context?.previousQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
      })
      toast.error((err as Error)?.message || 'Failed to like post')
    },

    onSuccess: (res: any) => {
      if (res?.likesCount !== undefined) {
        updatePostInCache(post.id, (p) => ({
          ...p,
          isLikedByViewer: res.isLiked ?? p.isLikedByViewer,
          likesCount: res.likesCount,
        }))
      }
    },
  })

  // ── Delete mutation ────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => postsApi.deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['profile', 'posts'] })
      queryClient.invalidateQueries({ queryKey: ['community'] })
      toast.success('Post deleted')
    },
    onError: (err) => {
      toast.error((err as Error)?.message || 'Failed to delete post')
    },
  })

  // ── Handlers ───────────────────────────────────────────────────────────────

  const triggerHeartPop = useCallback(() => {
    setIsPopping(true)
    if (popTimeoutRef.current) clearTimeout(popTimeoutRef.current)
    popTimeoutRef.current = setTimeout(() => setIsPopping(false), HEART_POP_MS)
  }, [])

  const handleLikeClick = useCallback(() => {
    triggerHeartPop()
    likeMutation.mutate(!post.isLikedByViewer)
  }, [likeMutation, post.isLikedByViewer, triggerHeartPop])

  const handleMediaClick = useCallback(
    (media: MediaItem[], index: number) => {
      const now = Date.now()
      const delta = now - lastTapRef.current

      if (delta > 0 && delta < DOUBLE_TAP_MS) {
        // Double-tap → like + burst
        setShowBurstHeart(true)
        if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current)
        burstTimeoutRef.current = setTimeout(() => setShowBurstHeart(false), BURST_MS)

        if (!post.isLikedByViewer) {
          handleLikeClick()
        } else {
          triggerHeartPop()
        }

        lastTapRef.current = 0
        return
      }

      lastTapRef.current = now

      // Delay single-click action so double-tap can cancel it
      setTimeout(() => {
        if (lastTapRef.current === now) {
          onMediaClick?.(media, index)
        }
      }, DOUBLE_TAP_MS + 20)
    },
    [handleLikeClick, onMediaClick, post.isLikedByViewer, triggerHeartPop]
  )

  const handleDelete = useCallback(() => {
    toast('Delete this post?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete',
        onClick: () => deleteMutation.mutate(),
      },
      cancel: {
        label: 'Cancel',
        onClick: () => { },
      },
    })
  }, [deleteMutation])

  // ── Click outside to close menu ────────────────────────────────────────────

  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showMenu])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (popTimeoutRef.current) clearTimeout(popTimeoutRef.current)
      if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current)
    }
  }, [])

  // ── Media grid class helpers ───────────────────────────────────────────────

  const mediaCount = post.media?.length ?? 0
  const mediaGridClass =
    mediaCount === 1
      ? 'flex items-center justify-center bg-black/5 dark:bg-black/40'
      : mediaCount === 2
        ? 'grid grid-cols-2 gap-0.5'
        : 'grid grid-cols-2 grid-rows-2 gap-0.5'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <article className="border-b border-border-subtle bg-surface sm:bg-transparent">
      <div className="px-3.5 py-4 sm:px-1 sm:py-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-2.5 sm:gap-3 mb-3">
          <Link
            to="/profile/$username"
            params={{ username: authorUsername }}
            className="shrink-0 block"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar src={avatarUrl} alt={authorName} name={authorName} />
          </Link>

          <div className="min-w-0 flex-1">
            <Link
              to="/profile/$username"
              params={{ username: authorUsername }}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 flex-wrap min-w-0 group"
            >
              <span className="font-semibold text-foreground text-[15px] leading-tight truncate group-hover:underline">
                {authorName}
              </span>
              {isUserVerified(post.author) && <VerifiedBadge />}
              <span className="text-xs text-foreground-muted truncate group-hover:underline">
                @{authorUsername}
              </span>
            </Link>

            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground-muted flex-wrap">
              <time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString()}>
                {formatRelativeDate(post.createdAt)}
              </time>
              <span aria-hidden="true">·</span>
              <span
                className="inline-flex items-center gap-1"
                title={VISIBILITY_LABELS[post.visibility] ?? 'Public'}
              >
                <VisibilityIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="sr-only">
                  {VISIBILITY_LABELS[post.visibility] ?? 'Public'}
                </span>
              </span>
              {department && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-[140px] sm:max-w-none">{department}</span>
                </>
              )}
            </div>
          </div>

          {/* ── Menu ─────────────────────────────────────────────────────── */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu((v) => !v)}
              className="p-1.5 rounded-full text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
              aria-label="More options"
              aria-expanded={showMenu}
              aria-haspopup="menu"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showMenu && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 w-48 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-surface shadow-md py-1 z-20"
              >
                {isOwner ? (
                  <>
                    <button
                      role="menuitem"
                      type="button"
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
                      role="menuitem"
                      type="button"
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
                    role="menuitem"
                    type="button"
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

        {/* ── Content ────────────────────────────────────────────────────── */}
        {post.content && <PostContent content={post.content} />}

        {/* ── Media Grid ─────────────────────────────────────────────────── */}
        {mediaCount > 0 && (
          <div
            className={`relative mt-3.5 -mx-4 sm:mx-0 overflow-hidden sm:rounded-xl border-y sm:border border-border-subtle bg-surface-muted/40 ${mediaGridClass}`}
          >
            {/* Double-tap burst heart */}
            {showBurstHeart && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-[1px] rounded-xl">
                <Heart className="h-24 w-24 sm:h-32 sm:w-32 fill-rose-500 text-rose-500 drop-shadow-2xl animate-heart-burst" />
              </div>
            )}

            {(post.media as MediaItem[]).slice(0, 4).map((m, i) => {
              const isSingle = mediaCount === 1
              const isTallLeft = mediaCount === 3 && i === 0

              return (
                <div
                  key={m.id ?? i}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleMediaClick(post.media as MediaItem[], i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleMediaClick(post.media as MediaItem[], i)
                    }
                  }}
                  className={`relative cursor-pointer overflow-hidden group select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isSingle
                      ? 'w-full flex justify-center items-center'
                      : isTallLeft
                        ? 'row-span-2 h-full'
                        : 'h-full min-h-[160px]'
                    }`}
                >
                  {m.type === 'VIDEO' ? (
                    <video
                      src={m.url}
                      muted
                      playsInline
                      preload="metadata"
                      className={
                        isSingle
                          ? 'w-full max-h-[650px] object-contain rounded-xl'
                          : 'w-full h-full object-cover'
                      }
                    />
                  ) : (
                    <img
                      src={m.url}
                      alt={`Media ${i + 1} of ${mediaCount}`}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className={
                        isSingle
                          ? 'w-full h-auto max-h-[700px] object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]'
                          : 'w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]'
                      }
                    />
                  )}

                  {/* +N overlay */}
                  {mediaCount > 4 && i === 3 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-xl font-bold tabular-nums">
                        +{mediaCount - 4}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Poll ───────────────────────────────────────────────────────── */}
        {(post as any).poll && (
          <div className="mt-3">
            <PollCard poll={(post as any).poll} hideQuestion />
          </div>
        )}
      </div>

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 pb-4 sm:px-1 sm:pb-5">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleLikeClick}
            disabled={likeMutation.isPending}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all select-none active:scale-95 disabled:opacity-70 ${post.isLikedByViewer
                ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/15'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted'
              }`}
            aria-pressed={post.isLikedByViewer}
            aria-label={post.isLikedByViewer ? 'Unlike post' : 'Like post'}
          >
            <Heart
              className={`h-4 w-4 transition-transform duration-150 ${post.isLikedByViewer
                  ? 'fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400'
                  : 'group-hover:scale-110'
                } ${isPopping ? 'animate-heart-pop' : ''}`}
            />
            <span className="tabular-nums">
              {post.likesCount > 0 ? post.likesCount : 'Like'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-all active:scale-95"
            aria-expanded={showComments}
            aria-label={showComments ? 'Hide comments' : 'Show comments'}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="tabular-nums">
              {post.commentsCount > 0 ? post.commentsCount : 'Comment'}
            </span>
          </button>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-all active:scale-95"
          aria-label="Share post"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {/* ── Comments ───────────────────────────────────────────────────────── */}
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

export const PostCard = memo(PostCardComponent)