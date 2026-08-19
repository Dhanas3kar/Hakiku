import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi, type PostItem, type PostVisibility } from '../../api/posts'
import { useAuth } from '../../hooks/useAuth'
import { Heart, MessageCircle, MoreVertical, Share2, Globe, Users, Lock, Trash2, Edit2, Flag } from 'lucide-react'
import { CommentsSection } from './CommentsSection'
import { ReportDialog } from '../community/ReportDialog'

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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['feed'] })
      // Snapshot the previous value
      const previousQueries = queryClient.getQueriesData({ queryKey: ['feed'] })
      // Optimistically update
      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old || !old.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((p: PostItem) => {
              if (p.id === post.id) {
                return {
                  ...p,
                  isLiked: liked,
                  likeCount: liked ? p.likeCount + 1 : p.likeCount - 1,
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
  })

  const handleLikeClick = () => {
    likeMutation.mutate(!post.isLiked)
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      deleteMutation.mutate()
    }
  }

  return (
    <article className="mb-4 rounded-xl border border-border bg-surface-elevated shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-surface-muted border border-border shrink-0">
              {post.author.avatarUrl ? (
                <img src={post.author.avatarUrl} alt={post.author.displayName || post.author.fullName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted">
                  {(post.author.displayName || post.author.fullName || '?').charAt(0)}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm sm:text-base leading-tight">
                  {post.author.displayName || post.author.fullName}
                </span>
                <span className="text-xs text-foreground-muted">@{post.author.username}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground-muted mt-0.5">
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span className="flex items-center gap-1" title={VISIBILITY_LABELS[post.visibility] || 'Public'}>
                  <VisibilityIcon className="h-3 w-3" />
                  <span className="sr-only">{VISIBILITY_LABELS[post.visibility] || 'Public'}</span>
                </span>
                {post.author.department && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[120px]">{post.author.department}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-full text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-surface shadow-md py-1 z-10">
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
          <div className="text-sm sm:text-base text-foreground whitespace-pre-wrap break-words mb-3 leading-relaxed">
            {post.content}
          </div>
        )}

        {/* Media Grid */}
        {post.media && post.media.length > 0 && (
          <div className={`mt-3 grid gap-1 overflow-hidden rounded-xl border border-border bg-surface-muted ${
            post.media.length === 1 ? 'grid-cols-1' :
            post.media.length === 2 ? 'grid-cols-2 aspect-video' :
            post.media.length === 3 ? 'grid-cols-2 grid-rows-2 aspect-square' :
            'grid-cols-2 grid-rows-2 aspect-square'
          }`}>
            {(post.media ?? []).slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                onClick={() => onMediaClick?.(post.media ?? [], i)}
                className={`relative cursor-pointer overflow-hidden group ${
                  post.media.length === 3 && i === 0 ? 'row-span-2' : ''
                }`}
              >
                {m.type === 'VIDEO' ? (
                  <video src={m.url} className="h-full w-full object-cover" />
                ) : (
                  <img src={m.url} alt="Post media" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                )}
                {/* Overlay for +N more images */}
                {post.media.length > 4 && i === 3 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-xl font-bold">+{post.media.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 bg-surface-muted/30">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLikeClick}
            disabled={likeMutation.isPending}
            className={`flex items-center gap-1.5 p-1.5 rounded-lg text-sm font-medium transition-colors ${
              post.isLiked ? 'text-primary' : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
            <span>{post.likeCount > 0 ? post.likeCount : 'Like'}</span>
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 p-1.5 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{post.commentCount > 0 ? post.commentCount : 'Comment'}</span>
          </button>
        </div>

        <button className="flex items-center gap-1.5 p-1.5 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors">
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {/* Comments Section */}
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
