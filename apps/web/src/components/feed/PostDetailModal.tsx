import { useQuery } from '@tanstack/react-query'
import { postsApi } from '../../api/posts'
import { PostCard } from './PostCard'
import { Loader2, X } from 'lucide-react'
import { useEffect } from 'react'

interface PostDetailModalProps {
  postId: string
  onClose: () => void
  onEdit?: (post: any) => void
  onMediaClick?: (media: any[], startIndex: number) => void
}

export function PostDetailModal({ postId, onClose, onEdit, onMediaClick }: PostDetailModalProps) {
  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => postsApi.getPost(postId),
    staleTime: 30 * 1000,
  })

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-xl shadow-2xl border border-border flex flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <h2 className="text-lg font-semibold">Post Details</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-muted transition-colors text-foreground-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 flex-1">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : isError || !post ? (
            <div className="text-center py-12">
              <p className="text-danger font-medium">Post not found or unavailable</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-surface text-foreground font-medium rounded-lg hover:bg-surface-muted transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <PostCard 
              post={post} 
              onEdit={onEdit} 
              onMediaClick={onMediaClick} 
            />
          )}
        </div>
      </div>
    </div>
  )
}
