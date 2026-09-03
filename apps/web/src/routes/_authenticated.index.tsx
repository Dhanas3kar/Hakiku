import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { feedApi } from '../api/feed'
import { ConfessionHero } from '../components/feed/ConfessionHero'
import { PostComposer } from '../components/feed/PostComposer'
import { PostCard } from '../components/feed/PostCard'
import { FeedSkeleton } from '../components/feed/FeedSkeleton'
import { EditPostModal } from '../components/feed/EditPostModal'
import { MediaViewerModal } from '../components/feed/MediaViewerModal'
import { PostDetailModal } from '../components/feed/PostDetailModal'
import { useState, useEffect, useRef } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import type { PostItem } from '../api/posts'
import { z } from 'zod'

const searchSchema = z.object({
  postId: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/')({
  component: Home,
  validateSearch: searchSchema,
})

function Home() {
  const [editingPost, setEditingPost] = useState<PostItem | null>(null)
  const [viewingMedia, setViewingMedia] = useState<{ media: any[]; index: number } | null>(null)
  const { postId } = Route.useSearch()
  const navigate = useNavigate()
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => feedApi.getPersonalizedFeed({ cursor: pageParam as string | undefined, limit: 10 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  // Intersection Observer for infinite scrolling
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage && status !== 'pending') {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleClosePostModal = () => {
    navigate({ to: '/', search: {} })
  }

  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full pb-16">
      <PostComposer />
      <ConfessionHero />

      <div className="flex flex-col">
        {status === 'pending' ? (
          <FeedSkeleton />
        ) : status === 'error' ? (
          <ErrorState
            title="Failed to load feed"
            description="We couldn’t load campus posts. Check your connection and try again."
            onRetry={() => window.location.reload()}
          />
        ) : (
          <>
            {data.pages.map((page: any, i) => (
              <div key={page.nextCursor || i}>
                {(page.items || []).map((post: PostItem) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onEdit={setEditingPost}
                    onMediaClick={(media, index) => setViewingMedia({ media, index })}
                  />
                ))}
              </div>
            ))}
            
            {/* Empty State */}
            {(data.pages[0]?.items || []).length === 0 && (
              <EmptyState
                title="No posts yet"
                description="Be the first to share something with campus. Your post will appear here."
              />
            )}

            {/* Load More Trigger */}
            <div ref={loadMoreRef} className="py-4 text-center">
              {isFetchingNextPage ? (
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : hasNextPage ? (
                <button
                  onClick={() => fetchNextPage()}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Load More
                </button>
              ) : (data.pages[0]?.items || []).length > 0 ? (
                <p className="text-sm text-foreground-subtle">You’re all caught up.</p>
              ) : null}
            </div>
          </>
        )}
      </div>

      {editingPost && (
        <EditPostModal post={editingPost} onClose={() => setEditingPost(null)} />
      )}

      {viewingMedia && (
        <MediaViewerModal
          media={viewingMedia.media}
          initialIndex={viewingMedia.index}
          onClose={() => setViewingMedia(null)}
        />
      )}

      {postId && (
        <PostDetailModal 
          postId={postId} 
          onClose={handleClosePostModal} 
          onEdit={setEditingPost}
          onMediaClick={(media, index) => setViewingMedia({ media, index })}
        />
      )}
    </div>
  )
}
