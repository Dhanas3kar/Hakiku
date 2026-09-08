import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { communityApi } from '../../api/community'
import type { Confession } from '../../api/community'
import { ConfessionComposer } from './ConfessionComposer'
// Removed useIntersectionObserver
import { formatDistanceToNow } from 'date-fns'
import { Loader2, MoreHorizontal, Flag, Trash2, Heart } from 'lucide-react'
import { ReportDialog } from './ReportDialog'
import { confessionsApi } from '../../api/confessions'

export function ConfessionFeed() {
  const {
    data,
    status,
  } = useQuery({
    queryKey: ['confessions', 'top'],
    queryFn: () => communityApi.listConfessions({ offset: 0, limit: 50 }),
  })

  // Get all fetched confessions, sort by upvoteCount descending, and take the first one
  const allConfessions = data?.items ?? []
  const topConfession = allConfessions.length > 0 
    ? [...allConfessions].sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0))[0]
    : null

  const confessions = topConfession ? [topConfession] : []

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

  const upvoteMutation = useMutation({
    mutationFn: () => confessionsApi.upvoteConfession(confession.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['confessions'] })
      const previousConfessions = queryClient.getQueryData(['confessions'])
      
      queryClient.setQueryData(['confessions'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: any) => {
              if (item.id === confession.id) {
                const isCurrentlyUpvoted = item.isUpvoted
                return {
                  ...item,
                  isUpvoted: !isCurrentlyUpvoted,
                  upvoteCount: (item.upvoteCount || 0) + (isCurrentlyUpvoted ? -1 : 1)
                }
              }
              return item
            })
          }))
        }
      })
      
      return { previousConfessions }
    },
    onError: (_err, _newVal, context) => {
      queryClient.setQueryData(['confessions'], context?.previousConfessions)
    },
    onSettled: () => {
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

        <div className="mt-4 flex items-center gap-4 border-t border-border-subtle pt-3">
          <button
            onClick={() => upvoteMutation.mutate()}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              confession.isUpvoted ? 'text-rose-500' : 'text-foreground-muted hover:text-rose-500'
            }`}
          >
            <Heart className={`h-4 w-4 ${confession.isUpvoted ? 'fill-current' : ''}`} />
            {confession.upvoteCount || 0}
          </button>
        </div>

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
