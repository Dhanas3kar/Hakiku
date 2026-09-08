import { memo } from 'react'
import { Skeleton } from '../ui/Skeleton'

interface FeedSkeletonProps {
  /** Number of skeleton posts to render */
  count?: number
  /** Show a media placeholder block (randomly varies for realism) */
  showMedia?: boolean
  /** Optional extra className on the root */
  className?: string
}

function PostSkeleton({ showMedia = true }: { showMedia?: boolean }) {
  // Vary media height slightly so the skeleton doesn't look too uniform
  const mediaHeight = showMedia
    ? ['h-48', 'h-56', 'h-64', 'h-72'][Math.floor(Math.random() * 4)]
    : null

  return (
    <article className="px-3.5 py-4 sm:px-1 sm:py-6" aria-hidden="true">
      {/* Header – avatar + meta */}
      <div className="flex items-start gap-2.5 sm:gap-3 mb-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />

        <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-28 sm:w-36" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>

        {/* Menu dots */}
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      </div>

      {/* Content lines */}
      <div className="space-y-2 mb-3.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-[92%]" />
        <Skeleton className="h-3.5 w-[68%]" />
      </div>

      {/* Optional media block */}
      {mediaHeight && (
        <div className="mb-4 -mx-4 sm:mx-0 overflow-hidden sm:rounded-xl">
          <Skeleton className={`w-full ${mediaHeight} rounded-none sm:rounded-xl`} />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-[72px] rounded-lg" />
        <Skeleton className="h-8 w-[88px] rounded-lg" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-9 rounded-lg" />
      </div>
    </article>
  )
}

function FeedSkeletonComponent({
  count = 3,
  showMedia = true,
  className = '',
}: FeedSkeletonProps) {
  // Pre-generate stable keys + media decisions so React doesn't reshuffle
  const items = Array.from({ length: count }, (_, i) => ({
    id: i,
    // Deterministic-ish variation so media doesn't flicker on re-render
    hasMedia: showMedia && i % 3 !== 2,
  }))

  return (
    <div
      className={`divide-y divide-border-subtle ${className}`}
      aria-busy="true"
      aria-label="Loading feed"
      role="status"
    >
      {items.map((item) => (
        <PostSkeleton key={item.id} showMedia={item.hasMedia} />
      ))}

      {/* Screen-reader only status */}
      <span className="sr-only">Loading posts…</span>
    </div>
  )
}

export const FeedSkeleton = memo(FeedSkeletonComponent)