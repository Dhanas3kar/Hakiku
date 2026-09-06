import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { communityApi, type HotTake } from '../../api/community'
import { useAuth } from '../../hooks/useAuth'
import { Flame, Trash2, Edit2, Loader2, Calendar, MapPin, Clock, Link as LinkIcon, Info, Flag, ArrowBigUp, ArrowBigDown } from 'lucide-react'
import { ReportDialog } from './ReportDialog'
import { VerifiedBadge } from '../ui/VerifiedBadge'
import { isUserVerified } from '@/utils/user'
import { FormattedContent } from '@/components/ui/FormattedContent'
import { MentionTextarea } from '@/components/ui/MentionTextarea'

// Simple URL validator
const isValidUrl = (string: string) => {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}

export function HotTakesFeed() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [editingTakeId, setEditingTakeId] = useState<string | null>(null)

  // Form states
  const [content, setContent] = useState('')
  const [date, setDate] = useState('')
  const [place, setPlace] = useState('')
  const [time, setTime] = useState('')
  const [media, setMedia] = useState('')
  const [otherDetails, setOtherDetails] = useState('')

  const [reportTargetId, setReportTargetId] = useState<string | null>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status
  } = useInfiniteQuery({
    queryKey: ['hot-takes'],
    queryFn: ({ pageParam }) => communityApi.listHotTakes({ limit: 10, offset: pageParam ? Number(pageParam) : 0 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: any) => lastPage?.nextCursorAt ? Number(lastPage.nextCursorAt) : undefined
  })

  const submitMutation = useMutation({
    mutationFn: (data: { content: string, date?: string, place?: string, time?: string, media?: string, otherDetails?: string }) => {
      if (editingTakeId) {
        return communityApi.updateHotTake(editingTakeId, data)
      }
      return communityApi.createHotTake(data)
    },
    onSuccess: () => {
      setContent('')
      setDate('')
      setPlace('')
      setTime('')
      setMedia('')
      setOtherDetails('')
      setIsCreating(false)
      setEditingTakeId(null)
      queryClient.invalidateQueries({ queryKey: ['hot-takes'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => communityApi.deleteHotTake(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hot-takes'] })
    }
  })

  const voteMutation = useMutation({
    mutationFn: ({ id, voteType }: { id: string; voteType: 'UP' | 'DOWN' }) =>
      communityApi.voteHotTake(id, voteType),
    onMutate: async ({ id, voteType }) => {
      await queryClient.cancelQueries({ queryKey: ['hot-takes'] })
      const previousData = queryClient.getQueryData(['hot-takes'])

      queryClient.setQueryData(['hot-takes'], (old: any) => {
        if (!old) return old
        const newPages = old.pages.map((page: any) => ({
          ...page,
          items: page.items.map((take: HotTake) => {
            if (take.id !== id) return take

            let newVote: 'UP' | 'DOWN' | null = voteType
            let upDiff = 0
            let downDiff = 0

            if (take.userVote === voteType) {
              // Toggle off
              newVote = null
              if (voteType === 'UP') upDiff = -1
              else downDiff = -1
            } else if (take.userVote) {
              // Switch vote
              if (voteType === 'UP') {
                upDiff = 1
                downDiff = -1
              } else {
                upDiff = -1
                downDiff = 1
              }
            } else {
              // New vote
              if (voteType === 'UP') upDiff = 1
              else downDiff = 1
            }

            const upvotesCount = Math.max(0, (take.upvotesCount || 0) + upDiff)
            const downvotesCount = Math.max(0, (take.downvotesCount || 0) + downDiff)

            return {
              ...take,
              userVote: newVote,
              upvotesCount,
              downvotesCount,
              score: upvotesCount - downvotesCount,
            }
          }),
        }))
        return { ...old, pages: newPages }
      })

      return { previousData }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['hot-takes'], context?.previousData)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['hot-takes'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitMutation.isPending) return
    submitMutation.mutate({
      content: content.trim(),
      date,
      place,
      time,
      media,
      otherDetails
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
          <Flame className="h-5 w-5 text-orange-500" />
          Campus Hot Takes
        </h3>
        <button
          onClick={() => {
            if (isCreating) {
              setContent('')
              setDate('')
              setPlace('')
              setTime('')
              setMedia('')
              setOtherDetails('')
              setEditingTakeId(null)
            }
            setIsCreating(!isCreating)
          }}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-full hover:bg-primary-hover transition-colors"
        >
          {isCreating ? 'Cancel' : 'Add Hot Take'}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="bg-surface border border-border p-4 rounded-xl shadow-sm mb-6 flex flex-col gap-3">
          <MentionTextarea
            value={content}
            onChangeValue={setContent}
            placeholder="What's your controversial opinion? Type @ to tag someone..."
            className="w-full bg-surface-muted border border-border rounded-lg p-3 min-h-[100px] resize-none focus:outline-none focus:border-primary text-foreground"
            containerClassName="w-full"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2">
              <Calendar className="h-4 w-4 text-foreground-muted shrink-0" />
              <input
                type="text"
                value={date}
                onChange={e => setDate(e.target.value)}
                placeholder="Date (Optional)"
                className="bg-transparent border-none w-full focus:outline-none text-foreground text-sm"
              />
            </div>
            <div className="flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2">
              <MapPin className="h-4 w-4 text-foreground-muted shrink-0" />
              <input
                type="text"
                value={place}
                onChange={e => setPlace(e.target.value)}
                placeholder="Place (Optional)"
                className="bg-transparent border-none w-full focus:outline-none text-foreground text-sm"
              />
            </div>
            <div className="flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2">
              <Clock className="h-4 w-4 text-foreground-muted shrink-0" />
              <input
                type="text"
                value={time}
                onChange={e => setTime(e.target.value)}
                placeholder="Time (Optional)"
                className="bg-transparent border-none w-full focus:outline-none text-foreground text-sm"
              />
            </div>
            <div className="flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2">
              <LinkIcon className="h-4 w-4 text-foreground-muted shrink-0" />
              <input
                type="text"
                value={media}
                onChange={e => setMedia(e.target.value)}
                placeholder="Media Link / URL (Optional)"
                className="bg-transparent border-none w-full focus:outline-none text-foreground text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm">
            <Info className="h-4 w-4 text-foreground-muted shrink-0" />
            <input
              type="text"
              value={otherDetails}
              onChange={e => setOtherDetails(e.target.value)}
              placeholder="Other Details (Optional)"
              className="bg-transparent border-none w-full focus:outline-none text-foreground text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false)
                setEditingTakeId(null)
              }}
              className="px-4 py-2 border border-border rounded-full text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || submitMutation.isPending}
              className="px-5 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-full hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2"
            >
              {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTakeId ? 'Update Take' : 'Post Hot Take'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {status === 'pending' ? (
          <div className="col-span-2 flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          data?.pages.map((page, i) => (
            <div key={i} className="contents">
              {page.items.map((take: HotTake) => (
                <div key={take.id} className="bg-surface border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group flex flex-col h-full justify-between">
                  <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                    <Flame className="h-16 w-16 text-orange-500" />
                  </div>
                  <div className="relative z-10 mb-6">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <p className="text-lg font-medium text-foreground whitespace-pre-wrap">"<FormattedContent content={take.content} />"</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {user?.userId === take.author?.id ? (
                          <>
                            <button
                              onClick={() => {
                                setEditingTakeId(take.id)
                                setContent(take.content)
                                setDate(take.date || '')
                                setPlace(take.place || '')
                                setTime(take.time || '')
                                setMedia(take.media || '')
                                setOtherDetails(take.otherDetails || '')
                                setIsCreating(true)
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                              }}
                              className="text-foreground-muted hover:text-primary transition-colors p-1"
                              title="Edit Hot Take"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(take.id)}
                              disabled={deleteMutation.isPending}
                              className="text-foreground-muted hover:text-red-500 transition-colors p-1"
                              title="Delete Hot Take"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setReportTargetId(take.id)}
                            className="text-foreground-muted hover:text-orange-500 transition-colors p-1"
                            title="Report Hot Take"
                          >
                            <Flag className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata Section */}
                    {(take.place || take.date || take.time || take.media || take.otherDetails) && (
                      <div className="mt-4 space-y-1.5 text-sm text-foreground-muted bg-surface-muted/50 p-3 rounded-lg">
                        {take.place && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>{take.place}</span>
                          </div>
                        )}
                        {take.date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>{take.date}</span>
                          </div>
                        )}
                        {take.time && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>{take.time}</span>
                          </div>
                        )}
                        {take.media && (
                          <div className="flex items-center gap-2">
                            <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                            {isValidUrl(take.media) ? (
                              <a href={take.media} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                                {take.media}
                              </a>
                            ) : (
                              <span className="truncate">{take.media}</span>
                            )}
                          </div>
                        )}
                        {take.otherDetails && (
                          <div className="flex items-start gap-2">
                            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{take.otherDetails}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Author Info & Upvote/Downvote Pills */}
                  <div className="relative z-10 flex items-center justify-between gap-3 mt-auto pt-3 border-t border-border-subtle">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full overflow-hidden bg-surface-muted shrink-0">
                        {take.author?.avatarUrl ? (
                          <img src={take.author.avatarUrl} alt={take.author.displayName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted text-xs">
                            {(take.author?.displayName || '?').charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-foreground truncate">{take.author?.displayName || 'Student'}</span>
                          {isUserVerified(take.author) && <VerifiedBadge />}
                        </div>
                        <span className="text-xs text-foreground-muted truncate">@{take.author?.username || 'user'}</span>
                      </div>
                    </div>

                    {/* Upvote & Downvote Control Pill */}
                    <div className="inline-flex items-center gap-1 bg-surface-muted rounded-full p-1 border border-border shrink-0">
                      <button
                        type="button"
                        onClick={() => voteMutation.mutate({ id: take.id, voteType: 'UP' })}
                        className={`p-1 rounded-full transition-colors ${
                          take.userVote === 'UP'
                            ? 'bg-orange-500 text-white font-bold shadow-xs'
                            : 'text-foreground-muted hover:text-orange-500 hover:bg-surface'
                        }`}
                        title="Upvote Hot Take"
                      >
                        <ArrowBigUp className="h-4 w-4 fill-current" />
                      </button>

                      <span className={`text-xs font-semibold px-1 min-w-[1.25rem] text-center ${
                        (take.score || 0) > 0 ? 'text-orange-500 font-bold' : (take.score || 0) < 0 ? 'text-blue-500 font-bold' : 'text-foreground-muted'
                      }`}>
                        {take.score || 0}
                      </span>

                      <button
                        type="button"
                        onClick={() => voteMutation.mutate({ id: take.id, voteType: 'DOWN' })}
                        className={`p-1 rounded-full transition-colors ${
                          take.userVote === 'DOWN'
                            ? 'bg-blue-500 text-white font-bold shadow-xs'
                            : 'text-foreground-muted hover:text-blue-500 hover:bg-surface'
                        }`}
                        title="Downvote Hot Take"
                      >
                        <ArrowBigDown className="h-4 w-4 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {hasNextPage && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 text-primary font-semibold text-sm hover:underline"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More Takes'}
          </button>
        </div>
      )}

      {reportTargetId && (
        <ReportDialog
          isOpen={true}
          onClose={() => setReportTargetId(null)}
          targetId={reportTargetId}
          targetType="HOT_TAKE"
        />
      )}
    </div>
  )
}
