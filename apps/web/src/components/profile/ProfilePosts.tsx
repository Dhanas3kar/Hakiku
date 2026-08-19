import { useInfiniteQuery } from '@tanstack/react-query'
import { useIntersectionObserver } from 'usehooks-ts'
import { useEffect } from 'react'
import { postsApi } from '../../api/posts'
import type { UserProfile } from '../../api/profile'
import { PostCard } from '../feed/PostCard'
import { FeedSkeleton } from '../feed/FeedSkeleton'
import { FileText } from 'lucide-react'

interface Props {
  profile: UserProfile
  isOwnProfile: boolean
}

export function ProfilePosts({ profile, isOwnProfile }: Props) {
  const { isIntersecting: inView, ref } = useIntersectionObserver({
    threshold: 0.1,
  })

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['profile', 'posts', profile.userId],
    queryFn: ({ pageParam = undefined }) =>
      postsApi.getUserPosts(profile.userId, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, isLoading])

  const posts = data?.pages.flatMap((page) => page.items) ?? []

  if (isLoading) {
    return (
      <div className="mt-6 flex flex-col gap-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground px-1">
          <FileText className="h-5 w-5 text-foreground-muted" />
          Posts
        </h2>
        <FeedSkeleton count={3} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-12 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">Failed to load posts</h3>
        <p className="mt-2 text-sm text-foreground-muted">Please try again later.</p>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-12 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">No posts yet</h3>
        <p className="mt-2 text-sm text-foreground-muted">
          {isOwnProfile ? "You haven't posted anything yet." : "This user hasn't posted anything yet."}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground px-1">
        <FileText className="h-5 w-5 text-foreground-muted" />
        Posts
      </h2>
      
      <div className="flex flex-col gap-6">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {hasNextPage && (
        <div ref={ref} className="py-4 text-center">
          {isFetchingNextPage ? (
            <span className="text-sm text-foreground-muted">Loading more...</span>
          ) : (
            <span className="text-sm text-foreground-muted">Scroll for more</span>
          )}
        </div>
      )}
    </div>
  )
}
