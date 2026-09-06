import { useState } from 'react'
import { communityApi } from '../../api/community'
import type { Poll } from '../../api/community'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, MoreHorizontal, Flag } from 'lucide-react'
import { ReportDialog } from './ReportDialog'
import { toast } from 'sonner'

function updatePollData(p: Poll, optionId: string): Poll {
  const currentVotes = p.userVotedOptionIds ?? []
  const isAlreadyVotedThisOption = currentVotes.includes(optionId)
  let nextVotes: string[] = []
  let newOptions = (p.options ?? []).map(opt => ({ ...opt }))

  if (!p.isMultipleChoice) {
    if (isAlreadyVotedThisOption) {
      nextVotes = []
      newOptions = newOptions.map(opt => opt.id === optionId ? { ...opt, voteCount: Math.max(0, opt.voteCount - 1) } : opt)
    } else {
      const prevOptionId = currentVotes[0]
      nextVotes = [optionId]
      newOptions = newOptions.map(opt => {
        if (opt.id === prevOptionId) return { ...opt, voteCount: Math.max(0, opt.voteCount - 1) }
        if (opt.id === optionId) return { ...opt, voteCount: opt.voteCount + 1 }
        return opt
      })
    }
  } else {
    if (isAlreadyVotedThisOption) {
      nextVotes = currentVotes.filter(id => id !== optionId)
      newOptions = newOptions.map(opt => opt.id === optionId ? { ...opt, voteCount: Math.max(0, opt.voteCount - 1) } : opt)
    } else {
      nextVotes = [...currentVotes, optionId]
      newOptions = newOptions.map(opt => opt.id === optionId ? { ...opt, voteCount: opt.voteCount + 1 } : opt)
    }
  }

  return {
    ...p,
    userVotedOptionIds: nextVotes,
    options: newOptions,
  }
}

export function PollCard({ poll, hideQuestion = false }: { poll: Poll; hideQuestion?: boolean }) {
  const queryClient = useQueryClient()
  const [reportOpen, setReportOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const totalVotes = (poll.options ?? []).reduce((sum, opt) => sum + opt.voteCount, 0)
  const hasVoted = (poll.userVotedOptionIds ?? []).length > 0
  const isPollActive = poll.isActive !== undefined ? poll.isActive : (poll.status ? poll.status === 'PUBLISHED' : true)

  const voteMutation = useMutation({
    mutationFn: (optionId: string) => communityApi.votePoll(poll.id, optionId),
    onMutate: async (optionId) => {
      await queryClient.cancelQueries({ queryKey: ['polls'] })
      await queryClient.cancelQueries({ queryKey: ['feed'] })
      const previousPolls = queryClient.getQueryData(['polls'])
      const previousFeed = queryClient.getQueryData(['feed'])

      queryClient.setQueryData(['polls'], (old: any) => {
        if (!old || !old.pages) return old
        const newPages = old.pages.map((page: any) => ({
          ...page,
          items: (page.items || []).map((p: Poll) => {
            if (p.id !== poll.id) return p
            return updatePollData(p, optionId)
          })
        }))
        return { ...old, pages: newPages }
      })

      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old || !old.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: (page.items || []).map((post: any) => {
              if (post.poll?.id !== poll.id) return post
              return {
                ...post,
                poll: updatePollData(post.poll, optionId),
              }
            }),
          })),
        }
      })

      return { previousPolls, previousFeed }
    },
    onError: (err: any, _newVote, context) => {
      if (context?.previousPolls) queryClient.setQueryData(['polls'], context.previousPolls)
      if (context?.previousFeed) queryClient.setQueriesData({ queryKey: ['feed'] }, context.previousFeed)
      toast.error(err.message || 'Failed to submit vote')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    }
  })

  return (
    <>
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
        {!hideQuestion && (
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
        )}

        <div className="space-y-3">
          {(poll.options ?? []).map(option => {
            const isVoted = (poll.userVotedOptionIds ?? []).includes(option.id)
            const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0
            
            return (
              <div key={option.id} className="relative">
                <button
                  onClick={() => isPollActive && !voteMutation.isPending && voteMutation.mutate(option.id)}
                  disabled={!isPollActive || voteMutation.isPending}
                  className={`w-full relative overflow-hidden flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    isVoted 
                      ? 'border-primary bg-primary/5 font-semibold' 
                      : 'border-border hover:border-primary/50 hover:bg-surface-muted cursor-pointer'
                  }`}
                >
                  {/* Progress bar background for results */}
                  {hasVoted && (
                    <div 
                      className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out rounded-xl ${
                        isVoted ? 'bg-primary/25 border-r border-primary/40' : 'bg-surface-muted/90'
                      }`} 
                      style={{ width: `${percentage}%` }}
                    />
                  )}
                  
                  <div className="flex items-center gap-3 relative z-10 min-w-0 flex-1">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      isVoted ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground-muted/40'
                    }`}>
                      {isVoted && <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />}
                    </div>
                    <span className={`text-sm font-medium truncate ${isVoted ? 'text-primary font-semibold' : 'text-foreground'}`}>
                      {option.text}
                    </span>
                  </div>
                  
                  {hasVoted && (
                    <span className={`text-sm font-bold relative z-10 pl-3 shrink-0 tabular-nums ${isVoted ? 'text-primary' : 'text-foreground-muted'}`}>
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
          <span>{isPollActive ? 'Active' : 'Closed'}</span>
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
