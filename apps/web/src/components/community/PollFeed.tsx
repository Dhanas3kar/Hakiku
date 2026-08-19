import { useInfiniteQuery } from '@tanstack/react-query'
import { communityApi } from '../../api/community'
import { PollCard } from './PollCard'
import { useIntersectionObserver } from 'usehooks-ts'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export function PollFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['polls'],
    queryFn: ({ pageParam }) => communityApi.listPolls({ offset: pageParam ? Number(pageParam) : 0, limit: 10 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.items.length < 10) return undefined
      return String(allPages.length * 10)
    },
  })

  const polls = data?.pages.flatMap((page) => page.items) ?? []

  const { isIntersecting, ref: bottomRef } = useIntersectionObserver({
    threshold: 0.1,
  })

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage && status !== 'pending') {
      fetchNextPage()
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage, status])

  if (status === 'pending') {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-surface-muted rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (polls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-2xl bg-surface-muted/30">
        <div className="h-12 w-12 rounded-full bg-surface mb-4 flex items-center justify-center text-foreground-muted">
          📊
        </div>
        <h3 className="text-lg font-bold text-foreground">No Hot Takes yet</h3>
        <p className="text-sm text-foreground-muted max-w-sm mt-1">
          Check back later to vote on the latest campus debates.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {polls.map((poll) => (
        <PollCard key={poll.id} poll={poll} />
      ))}
      
      <div ref={bottomRef} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>
    </div>
  )
}
