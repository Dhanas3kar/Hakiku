import { useState } from 'react'
import { communityApi } from '../../api/community'
import type { Poll } from '../../api/community'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, MoreHorizontal, Flag } from 'lucide-react'
import { ReportDialog } from './ReportDialog'

export function PollCard({ poll }: { poll: Poll }) {
  const queryClient = useQueryClient()
  const [reportOpen, setReportOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const totalVotes = (poll.options ?? []).reduce((sum, opt) => sum + opt.voteCount, 0)
  const hasVoted = (poll.userVotedOptionIds ?? []).length > 0

  const voteMutation = useMutation({
    mutationFn: (optionId: string) => communityApi.votePoll(poll.id, optionId),
    onMutate: async (optionId) => {
      await queryClient.cancelQueries({ queryKey: ['polls'] })
      const previousPolls = queryClient.getQueryData(['polls'])

      queryClient.setQueryData(['polls'], (old: any) => {
        if (!old) return old
        const newPages = old.pages.map((page: any) => ({
          ...page,
          items: page.items.map((p: Poll) => {
            if (p.id !== poll.id) return p
            return {
              ...p,
              userVotedOptionIds: [...(p.userVotedOptionIds ?? []), optionId],
              options: (p.options ?? []).map(opt => 
                opt.id === optionId ? { ...opt, voteCount: opt.voteCount + 1 } : opt
              )
            }
          })
        }))
        return { ...old, pages: newPages }
      })

      return { previousPolls }
    },
    onError: (err, newVote, context) => {
      queryClient.setQueryData(['polls'], context?.previousPolls)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] })
    }
  })

  return (
    <>
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 block">
              Campus Poll
            </span>
            <h3 className="text-lg font-bold text-foreground leading-tight">
              {poll.question}
            </h3>
          </div>
          
          <div className="relative ml-4">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-muted rounded-full transition-colors"
            >
              <MoreHorizontal className="h-5 w-5" />
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
                    Report Poll
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {(poll.options ?? []).map(option => {
            const isVoted = (poll.userVotedOptionIds ?? []).includes(option.id)
            const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0
            
            return (
              <div key={option.id} className="relative">
                <button
                  onClick={() => !hasVoted && voteMutation.mutate(option.id)}
                  disabled={hasVoted || voteMutation.isPending}
                  className={`w-full relative overflow-hidden flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    isVoted 
                      ? 'border-primary bg-primary/5' 
                      : hasVoted 
                        ? 'border-border bg-surface-muted/50 cursor-default'
                        : 'border-border hover:border-primary/50 hover:bg-surface-muted'
                  }`}
                >
                  {/* Progress bar background for results */}
                  {hasVoted && (
                    <div 
                      className={`absolute inset-0 opacity-10 ${isVoted ? 'bg-primary' : 'bg-foreground-muted'}`} 
                      style={{ width: `${percentage}%` }}
                    />
                  )}
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      isVoted ? 'border-primary text-primary' : 'border-foreground-muted/30'
                    }`}>
                      {isVoted && <CheckCircle2 className="h-4 w-4" />}
                    </div>
                    <span className={`text-sm font-medium ${isVoted ? 'text-primary' : 'text-foreground'}`}>
                      {option.text}
                    </span>
                  </div>
                  
                  {hasVoted && (
                    <span className="text-sm font-bold text-foreground relative z-10 pl-4">
                      {percentage}%
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
        
        <div className="mt-4 flex items-center justify-between text-xs text-foreground-muted">
          <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
          <span>{poll.isActive ? 'Active' : 'Closed'}</span>
        </div>
      </div>

      <ReportDialog 
        isOpen={reportOpen} 
        onClose={() => setReportOpen(false)} 
        targetId={poll.id} 
        targetType="POLL" 
      />
    </>
  )
}
