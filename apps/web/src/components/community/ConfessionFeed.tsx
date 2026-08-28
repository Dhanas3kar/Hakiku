import { useState, useEffect } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { communityApi } from '../../api/community'
import type { Confession } from '../../api/community'
import { ConfessionComposer } from './ConfessionComposer'
import { useIntersectionObserver } from 'usehooks-ts'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, MoreHorizontal, Flag, Trash2 } from 'lucide-react'
import { ReportDialog } from './ReportDialog'

export function ConfessionFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['confessions'],
    queryFn: ({ pageParam }) => communityApi.listConfessions({ offset: pageParam ? Number(pageParam) : 0, limit: 15 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.items.length < 15) return undefined
      return String(allPages.length * 15)
    },
  })

  const confessions = data?.pages.flatMap((page) => page.items) ?? []

  const { isIntersecting, ref: bottomRef } = useIntersectionObserver({
    threshold: 0.1,
  })

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage && status !== 'pending') {
      fetchNextPage()
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage, status])

  return (
    <div className="space-y-6">
      <ConfessionComposer />
      
      {status === 'pending' ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-surface-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : confessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-foreground-muted">
          <p>No confessions yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {confessions.map((confession) => (
            <ConfessionCard key={confession.id} confession={confession} />
          ))}
          
          <div ref={bottomRef} className="h-10 flex items-center justify-center">
            {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </div>
        </div>
      )}
    </div>
  )
}

function ConfessionCard({ confession }: { confession: Confession }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  
  const queryClient = useQueryClient()
  
  const deleteMutation = useMutation({
    mutationFn: () => communityApi.deleteConfession(confession.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confessions'] })
    }
  })

  return (
    <>
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm transition-all hover:border-border-hover">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">Anonymous</span>
            <span className="text-xs text-foreground-muted">• {formatDistanceToNow(new Date(confession.publishedAt || confession.createdAt || new Date()))} ago</span>
          </div>
          
          <div className="relative ml-4">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-muted rounded-full transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-1 w-48 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden py-1">
                  <button 
                    onClick={() => {
                      setReportOpen(true)
                      setDropdownOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-surface-muted transition-colors text-left"
                  >
                    <Flag className="h-4 w-4" />
                    Report Confession
                  </button>
                  {confession.isAuthor && (
                    <button 
                      onClick={() => {
                        deleteMutation.mutate()
                        setDropdownOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-surface-muted transition-colors text-left"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Confession
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        
        <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap break-words">
          {confession.content}
        </p>

        {/* Keeping UI simple. Confession comments can be an expansion later if desired. */}
      </div>

      <ReportDialog 
        isOpen={reportOpen} 
        onClose={() => setReportOpen(false)} 
        targetId={confession.id} 
        targetType="CONFESSION" 
      />
    </>
  )
}
