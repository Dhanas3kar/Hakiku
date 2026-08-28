import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hotTakesApi } from '../../api/hotTakes'
import { Flame, Loader2, Send, Trash2, MapPin, Calendar, Clock, Link as LinkIcon, Info, Edit2, Flag } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { ReportDialog } from './ReportDialog'
import { VerifiedBadge } from '../ui/VerifiedBadge'
import { FormattedContent } from '@/components/ui/FormattedContent'

// Simple URL validator
const isValidUrl = (string: string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export function HotTakesFeed() {
  const { user } = useAuth()
  const [isCreating, setIsCreating] = useState(false)
  const [content, setContent] = useState('')
  const [date, setDate] = useState('')
  const [place, setPlace] = useState('')
  const [time, setTime] = useState('')
  const [media, setMedia] = useState('')
  const [otherDetails, setOtherDetails] = useState('')
  const [editingTakeId, setEditingTakeId] = useState<string | null>(null)
  const [reportTargetId, setReportTargetId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useInfiniteQuery({
    queryKey: ['hotTakes'],
    queryFn: ({ pageParam }) => hotTakesApi.getHotTakes({ cursor: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  })

  const createMutation = useMutation({
    mutationFn: () => hotTakesApi.createHotTake({
      content,
      date: date.trim() || undefined,
      place: place.trim() || undefined,
      time: time.trim() || undefined,
      media: media.trim() || undefined,
      otherDetails: otherDetails.trim() || undefined,
    }),
    onSuccess: () => {
      setContent('')
      setDate('')
      setPlace('')
      setTime('')
      setMedia('')
      setOtherDetails('')
      setIsCreating(false)
      queryClient.invalidateQueries({ queryKey: ['hotTakes'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hotTakesApi.deleteHotTake(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotTakes'] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, content: string, date?: string, place?: string, time?: string, media?: string, otherDetails?: string }) =>
      hotTakesApi.updateHotTake(data.id, {
        content: data.content,
        date: data.date?.trim() || undefined,
        place: data.place?.trim() || undefined,
        time: data.time?.trim() || undefined,
        media: data.media?.trim() || undefined,
        otherDetails: data.otherDetails?.trim() || undefined
      }),
    onSuccess: () => {
      setContent('')
      setDate('')
      setPlace('')
      setTime('')
      setMedia('')
      setOtherDetails('')
      setEditingTakeId(null)
      setIsCreating(false)
      queryClient.invalidateQueries({ queryKey: ['hotTakes'] })
    }
  })

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
              // clear on cancel
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
        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm mb-6 flex flex-col gap-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What's your controversial opinion?"
            className="w-full bg-surface-muted border border-border rounded-lg p-3 min-h-[100px] resize-none focus:outline-none focus:border-primary"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2">
              <Calendar className="h-4 w-4 text-foreground-muted shrink-0" />
              <input type="text" placeholder="Date (Optional)" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent border-none outline-none w-full" />
            </div>
            <div className="flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2">
              <MapPin className="h-4 w-4 text-foreground-muted shrink-0" />
              <input type="text" placeholder="Place (Optional)" value={place} onChange={e => setPlace(e.target.value)} className="bg-transparent border-none outline-none w-full" />
            </div>
            <div className="flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2">
              <Clock className="h-4 w-4 text-foreground-muted shrink-0" />
              <input type="text" placeholder="Time (Optional)" value={time} onChange={e => setTime(e.target.value)} className="bg-transparent border-none outline-none w-full" />
            </div>
            <div className="flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2">
              <LinkIcon className="h-4 w-4 text-foreground-muted shrink-0" />
              <input type="url" placeholder="Media URL (Optional)" value={media} onChange={e => setMedia(e.target.value)} className="bg-transparent border-none outline-none w-full" />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 bg-surface-muted border border-border rounded-lg px-3 py-2">
              <Info className="h-4 w-4 text-foreground-muted shrink-0" />
              <input type="text" placeholder="Other Details (Optional)" value={otherDetails} onChange={e => setOtherDetails(e.target.value)} className="bg-transparent border-none outline-none w-full" />
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <button
              onClick={() => {
                if (editingTakeId) {
                  updateMutation.mutate({
                    id: editingTakeId,
                    content,
                    date,
                    place,
                    time,
                    media,
                    otherDetails
                  })
                } else {
                  createMutation.mutate()
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending || !content.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center gap-2 hover:bg-primary-hover disabled:opacity-50"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTakeId ? 'Update Take' : 'Share Take'}
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {status === 'pending' ? (
          <div className="col-span-2 flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          data?.pages.map((page, i) => (
            <div key={i} className="contents">
              {page.items.map(take => (
                <div key={take.id} className="bg-surface border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group flex flex-col h-full justify-between">
                  <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                    <Flame className="h-16 w-16 text-orange-500" />
                  </div>
                  <div className="relative z-10 mb-6">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <p className="text-lg font-medium text-foreground whitespace-pre-wrap">"<FormattedContent content={take.content} />"</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {user?.id === take.author.id ? (
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

                  <div className="relative z-10 flex items-center gap-3 mt-auto">
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-surface-muted shrink-0">
                      {take.author.avatarUrl ? (
                        <img src={take.author.avatarUrl} alt={take.author.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted text-xs">
                          {take.author.displayName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-foreground truncate">{take.author.displayName}</span>
                        {take.author.isVerifiedIdentity && <VerifiedBadge />}
                      </div>
                      <span className="text-xs text-foreground-muted truncate">@{take.author.username}</span>
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
