import { createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { feedApi } from '../api/feed'
import { ConfessionHero } from '../components/feed/ConfessionHero'
import { PostComposer } from '../components/feed/PostComposer'
import { PostCard } from '../components/feed/PostCard'
import { FeedSkeleton } from '../components/feed/FeedSkeleton'
import { EditPostModal } from '../components/feed/EditPostModal'
import { MediaViewerModal } from '../components/feed/MediaViewerModal'
import { useState, useEffect, useRef } from 'react'
import type { PostItem } from '../api/posts'

export const Route = createFileRoute('/_authenticated/')({
  component: Home,
})

function Home() {
  const [editingPost, setEditingPost] = useState<PostItem | null>(null)
  const [viewingMedia, setViewingMedia] = useState<{ media: any[]; index: number } | null>(null)
  
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

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-20">
      <ConfessionHero />
      <PostComposer />

      <div className="flex flex-col">
        {status === 'pending' ? (
          <FeedSkeleton />
        ) : status === 'error' ? (
          <div className="text-center p-8 bg-surface-elevated rounded-xl border border-border">
            <p className="text-danger">Failed to load feed.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium"
            >
              Try Again
            </button>
          </div>
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
              <div className="text-center p-12 bg-surface-elevated rounded-xl border border-border">
                <p className="text-foreground-muted text-lg">No posts yet.</p>
                <p className="text-foreground-muted text-sm mt-2">Be the first to share something with the campus!</p>
              </div>
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
                <p className="text-sm text-foreground-muted">You've caught up on everything!</p>
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
    </div>
  )
}
