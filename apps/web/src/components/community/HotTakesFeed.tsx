import { useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ArrowBigDown,
  ArrowBigUp,
  Calendar,
  Clock,
  Edit2,
  Flag,
  Flame,
  Info,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Trash2,
  X,
} from 'lucide-react'

import {
  communityApi,
  type HotTake,
} from '../../api/community'
import { useAuth } from '../../hooks/useAuth'
import { ReportDialog } from './ReportDialog'
import { VerifiedBadge } from '../ui/VerifiedBadge'
import { isUserVerified } from '@/utils/user'
import { FormattedContent } from '@/components/ui/FormattedContent'
import { MentionTextarea } from '@/components/ui/MentionTextarea'

const PAGE_SIZE = 10

const isValidUrl = (value: string) => {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}

export function HotTakesFeed() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [isCreating, setIsCreating] =
    useState(false)
  const [editingTakeId, setEditingTakeId] =
    useState<string | null>(null)

  const [content, setContent] = useState('')
  const [date, setDate] = useState('')
  const [place, setPlace] = useState('')
  const [time, setTime] = useState('')
  const [media, setMedia] = useState('')
  const [otherDetails, setOtherDetails] =
    useState('')

  const [reportTargetId, setReportTargetId] =
    useState<string | null>(null)

  /*
   * Reset the entire composer.
   */
  const resetForm = () => {
    setContent('')
    setDate('')
    setPlace('')
    setTime('')
    setMedia('')
    setOtherDetails('')
    setEditingTakeId(null)
  }

  /*
   * Open composer for a new Hot Take.
   */
  const openCreateForm = () => {
    resetForm()
    setIsCreating(true)
  }

  /*
   * Close composer.
   */
  const closeForm = () => {
    resetForm()
    setIsCreating(false)
  }

  /*
   * Infinite Hot Takes query.
   */
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['hot-takes'],

    queryFn: ({ pageParam }) =>
      communityApi.listHotTakes({
        limit: PAGE_SIZE,
        offset: Number(pageParam) || 0,
      }),

    initialPageParam: 0,

    getNextPageParam: (
      lastPage: any,
    ) => {
      if (!lastPage?.nextCursorAt) {
        return undefined
      }

      return Number(
        lastPage.nextCursorAt,
      )
    },
  })

  /*
   * Create / update mutation.
   */
  const submitMutation = useMutation({
    mutationFn: async (payload: {
      content: string
      date?: string
      place?: string
      time?: string
      media?: string
      otherDetails?: string
    }) => {
      if (editingTakeId) {
        return communityApi.updateHotTake(
          editingTakeId,
          payload,
        )
      }

      return communityApi.createHotTake(
        payload,
      )
    },

    onSuccess: () => {
      resetForm()
      setIsCreating(false)

      queryClient.invalidateQueries({
        queryKey: ['hot-takes'],
      })
    },
  })

  /*
   * Delete mutation.
   */
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      communityApi.deleteHotTake(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['hot-takes'],
      })
    },
  })

  /*
   * Vote mutation with optimistic UI.
   */
  const voteMutation = useMutation({
    mutationFn: ({
      id,
      voteType,
    }: {
      id: string
      voteType: 'UP' | 'DOWN'
    }) =>
      communityApi.voteHotTake(
        id,
        voteType,
      ),

    onMutate: async ({
      id,
      voteType,
    }) => {
      await queryClient.cancelQueries({
        queryKey: ['hot-takes'],
      })

      const previousData =
        queryClient.getQueryData([
          'hot-takes',
        ])

      queryClient.setQueryData(
        ['hot-takes'],
        (old: any) => {
          if (!old?.pages) {
            return old
          }

          return {
            ...old,

            pages: old.pages.map(
              (page: any) => ({
                ...page,

                items: page.items.map(
                  (take: HotTake) => {
                    if (
                      take.id !== id
                    ) {
                      return take
                    }

                    const currentVote =
                      take.userVote ??
                      null

                    let nextVote:
                      | 'UP'
                      | 'DOWN'
                      | null =
                      voteType

                    let upDiff = 0
                    let downDiff = 0

                    /*
                     * Clicking the active vote
                     * toggles it off.
                     */
                    if (
                      currentVote ===
                      voteType
                    ) {
                      nextVote = null

                      if (
                        voteType ===
                        'UP'
                      ) {
                        upDiff = -1
                      } else {
                        downDiff = -1
                      }
                    }

                    /*
                     * Switching vote.
                     */
                    else if (
                      currentVote
                    ) {
                      if (
                        voteType ===
                        'UP'
                      ) {
                        upDiff = 1
                        downDiff = -1
                      } else {
                        upDiff = -1
                        downDiff = 1
                      }
                    }

                    /*
                     * First vote.
                     */
                    else {
                      if (
                        voteType ===
                        'UP'
                      ) {
                        upDiff = 1
                      } else {
                        downDiff = 1
                      }
                    }

                    const upvotesCount =
                      Math.max(
                        0,
                        (take.upvotesCount ??
                          0) +
                        upDiff,
                      )

                    const downvotesCount =
                      Math.max(
                        0,
                        (take.downvotesCount ??
                          0) +
                        downDiff,
                      )

                    return {
                      ...take,
                      userVote:
                        nextVote,
                      upvotesCount,
                      downvotesCount,
                      score:
                        upvotesCount -
                        downvotesCount,
                    }
                  },
                ),
              }),
            ),
          }
        },
      )

      return {
        previousData,
      }
    },

    onError: (
      _error,
      _variables,
      context,
    ) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ['hot-takes'],
          context.previousData,
        )
      }
    },

    onSuccess: (updatedVote: any) => {
      if (!updatedVote?.hotTakeId) return
      queryClient.setQueryData(
        ['hot-takes'],
        (old: any) => {
          if (!old?.pages) {
            return old
          }

          return {
            ...old,
            pages: old.pages.map(
              (page: any) => ({
                ...page,
                items: page.items.map(
                  (take: HotTake) => {
                    if (take.id !== updatedVote.hotTakeId) {
                      return take
                    }
                    return {
                      ...take,
                      userVote: updatedVote.userVote,
                      upvotesCount: updatedVote.upvotesCount,
                      downvotesCount: updatedVote.downvotesCount,
                      score: updatedVote.score,
                    }
                  },
                ),
              }),
            ),
          }
        },
      )
    },
  })

  /*
   * Submit form.
   */
  const handleSubmit = (
    e: React.FormEvent,
  ) => {
    e.preventDefault()

    const trimmedContent =
      content.trim()

    if (
      !trimmedContent ||
      submitMutation.isPending
    ) {
      return
    }

    submitMutation.mutate({
      content: trimmedContent,
      date: date.trim() || undefined,
      place: place.trim() || undefined,
      time: time.trim() || undefined,
      media: media.trim() || undefined,
      otherDetails:
        otherDetails.trim() ||
        undefined,
    })
  }

  /*
   * Start editing.
   */
  const handleEdit = (
    take: HotTake,
  ) => {
    setEditingTakeId(take.id)
    setContent(take.content)
    setDate(take.date || '')
    setPlace(take.place || '')
    setTime(take.time || '')
    setMedia(take.media || '')
    setOtherDetails(
      take.otherDetails || '',
    )

    setIsCreating(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  /*
   * Delete with a simple browser confirmation.
   */
  const handleDelete = (
    id: string,
  ) => {
    if (
      deleteMutation.isPending
    ) {
      return
    }

    const confirmed =
      window.confirm(
        'Delete this Hot Take? This action cannot be undone.',
      )

    if (!confirmed) {
      return
    }

    deleteMutation.mutate(id)
  }

  /*
   * Flatten pages for rendering.
   */
  const takes =
    data?.pages.flatMap(
      (page: any) =>
        page?.items || [],
    ) ?? []

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-base font-bold text-foreground sm:text-lg">
          <Flame className="h-5 w-5 shrink-0 text-orange-500" />
          <span>Campus Hot Takes</span>
        </h3>

        <button
          type="button"
          onClick={
            isCreating
              ? closeForm
              : openCreateForm
          }
          className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover sm:px-4 sm:text-sm"
        >
          {isCreating
            ? 'Cancel'
            : 'Add Hot Take'}
        </button>
      </div>

      {/* Composer */}
      {isCreating && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-surface p-3.5 shadow-sm sm:p-4"
        >
          {/* Editing indicator */}
          {editingTakeId && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
              <span className="font-medium">
                Editing Hot Take
              </span>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-md p-1 hover:bg-primary/10"
                aria-label="Cancel editing"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <MentionTextarea
            value={content}
            onChangeValue={setContent}
            placeholder="What's your controversial opinion? Type @ to tag someone..."
            className="min-h-[110px] w-full resize-none rounded-lg border border-border bg-surface-muted p-3 text-sm leading-relaxed text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            containerClassName="w-full"
          />

          {/* Metadata */}
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <MetadataInput
              icon={
                <Calendar className="h-4 w-4" />
              }
              value={date}
              onChange={setDate}
              placeholder="Date (Optional)"
            />

            <MetadataInput
              icon={
                <MapPin className="h-4 w-4" />
              }
              value={place}
              onChange={setPlace}
              placeholder="Place (Optional)"
            />

            <MetadataInput
              icon={
                <Clock className="h-4 w-4" />
              }
              value={time}
              onChange={setTime}
              placeholder="Time (Optional)"
            />

            <MetadataInput
              icon={
                <LinkIcon className="h-4 w-4" />
              }
              value={media}
              onChange={setMedia}
              placeholder="Media Link / URL (Optional)"
            />
          </div>

          {/* Other details */}
          <MetadataInput
            icon={
              <Info className="h-4 w-4" />
            }
            value={otherDetails}
            onChange={setOtherDetails}
            placeholder="Other Details (Optional)"
            className="mt-2.5"
          />

          {/* Error */}
          {submitMutation.isError && (
            <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {(
                submitMutation.error as any
              )?.response?.data
                ?.message ||
                submitMutation.error
                  ?.message ||
                'Failed to save Hot Take. Please try again.'
              }
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeForm}
              disabled={
                submitMutation.isPending
              }
              className="w-full rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                !content.trim() ||
                submitMutation.isPending
              }
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              {editingTakeId
                ? 'Update Take'
                : 'Post Hot Take'}
            </button>
          </div>
        </form>
      )}

      {/* Feed */}
      {status === 'pending' ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : takes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-muted/30 px-5 py-12 text-center">
          <Flame className="mx-auto mb-3 h-8 w-8 text-orange-500/60" />

          <h4 className="text-sm font-semibold text-foreground">
            No Hot Takes yet
          </h4>

          <p className="mt-1 text-xs text-foreground-muted">
            Be the first to drop a
            controversial campus opinion.
          </p>

          {!isCreating && (
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Add the first Hot Take
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2 md:gap-4">
          {takes.map(
            (take: HotTake) => {
              const score =
                take.score || 0

              const isOwnTake =
                user?.userId ===
                take.author?.id

              const isVoting =
                voteMutation.isPending &&
                voteMutation.variables
                  ?.id === take.id

              return (
                <article
                  key={take.id}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
                >
                  {/* Decorative flame */}
                  <div className="pointer-events-none absolute right-0 top-0 p-3 opacity-[0.07]">
                    <Flame className="h-16 w-16 text-orange-500" />
                  </div>

                  <div className="relative z-10 flex flex-1 flex-col">
                    {/* Content header */}
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-base font-medium leading-relaxed text-foreground sm:text-lg">
                        "
                        <FormattedContent
                          content={
                            take.content
                          }
                        />
                        "
                      </p>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-0.5">
                        {isOwnTake ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleEdit(
                                  take,
                                )
                              }
                              disabled={
                                deleteMutation.isPending ||
                                submitMutation.isPending
                              }
                              className="rounded-lg p-1.5 text-foreground-muted transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                              title="Edit Hot Take"
                              aria-label="Edit Hot Take"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  take.id,
                                )
                              }
                              disabled={
                                deleteMutation.isPending
                              }
                              className="rounded-lg p-1.5 text-foreground-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                              title="Delete Hot Take"
                              aria-label="Delete Hot Take"
                            >
                              {deleteMutation.isPending &&
                                deleteMutation.variables ===
                                take.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setReportTargetId(
                                take.id,
                              )
                            }
                            className="rounded-lg p-1.5 text-foreground-muted transition-colors hover:bg-orange-500/10 hover:text-orange-500"
                            title="Report Hot Take"
                            aria-label="Report Hot Take"
                          >
                            <Flag className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    {(
                      take.place ||
                      take.date ||
                      take.time ||
                      take.media ||
                      take.otherDetails
                    ) && (
                        <div className="mb-5 space-y-2 rounded-xl bg-surface-muted/50 p-3 text-xs text-foreground-muted sm:text-sm">
                          {take.place && (
                            <MetadataRow
                              icon={
                                <MapPin className="h-3.5 w-3.5" />
                              }
                              value={
                                take.place
                              }
                            />
                          )}

                          {take.date && (
                            <MetadataRow
                              icon={
                                <Calendar className="h-3.5 w-3.5" />
                              }
                              value={
                                take.date
                              }
                            />
                          )}

                          {take.time && (
                            <MetadataRow
                              icon={
                                <Clock className="h-3.5 w-3.5" />
                              }
                              value={
                                take.time
                              }
                            />
                          )}

                          {take.media && (
                            <MetadataRow
                              icon={
                                <LinkIcon className="h-3.5 w-3.5" />
                              }
                              value={
                                isValidUrl(
                                  take.media,
                                ) ? (
                                  <a
                                    href={
                                      take.media
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="min-w-0 truncate text-primary hover:underline"
                                  >
                                    {
                                      take.media
                                    }
                                  </a>
                                ) : (
                                  <span className="min-w-0 truncate">
                                    {
                                      take.media
                                    }
                                  </span>
                                )
                              }
                            />
                          )}

                          {take.otherDetails && (
                            <MetadataRow
                              icon={
                                <Info className="mt-0.5 h-3.5 w-3.5" />
                              }
                              value={
                                <span className="line-clamp-2">
                                  {
                                    take.otherDetails
                                  }
                                </span>
                              }
                              alignTop
                            />
                          )}
                        </div>
                      )}

                    {/* Footer */}
                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
                      {/* Author */}
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-surface-muted">
                          {take.author
                            ?.avatarUrl ? (
                            <img
                              src={
                                take
                                  .author
                                  .avatarUrl
                              }
                              alt={
                                take
                                  .author
                                  .displayName ||
                                'Student'
                              }
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-foreground-muted">
                              {(
                                take
                                  .author
                                  ?.displayName ||
                                '?'
                              ).charAt(
                                0,
                              )}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1">
                            <span className="truncate text-xs font-semibold text-foreground sm:text-sm">
                              {take.author
                                ?.displayName ||
                                'Student'}
                            </span>

                            {isUserVerified(
                              take.author,
                            ) && (
                                <VerifiedBadge />
                              )}
                          </div>

                          <span className="block truncate text-[11px] text-foreground-muted sm:text-xs">
                            @
                            {take.author
                              ?.username ||
                              'user'}
                          </span>
                        </div>
                      </div>

                      {/* Voting */}
                      <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface-muted p-1">
                        <button
                          type="button"
                          onClick={() =>
                            voteMutation.mutate(
                              {
                                id: take.id,
                                voteType:
                                  'UP',
                              },
                            )
                          }
                          disabled={
                            isVoting
                          }
                          className={`rounded-full p-1.5 transition-all disabled:cursor-wait ${take.userVote ===
                              'UP'
                              ? 'bg-orange-500 text-white shadow-xs'
                              : 'text-foreground-muted hover:bg-surface hover:text-orange-500'
                            }`}
                          title="Upvote"
                          aria-label="Upvote Hot Take"
                          aria-pressed={
                            take.userVote ===
                            'UP'
                          }
                        >
                          <ArrowBigUp className="h-4 w-4 fill-current" />
                        </button>

                        <span
                          className={`min-w-[1.5rem] px-1 text-center text-xs font-semibold ${score > 0
                              ? 'text-orange-500'
                              : score < 0
                                ? 'text-blue-500'
                                : 'text-foreground-muted'
                            }`}
                          aria-label={`Score ${score}`}
                        >
                          {score}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            voteMutation.mutate(
                              {
                                id: take.id,
                                voteType:
                                  'DOWN',
                              },
                            )
                          }
                          disabled={
                            isVoting
                          }
                          className={`rounded-full p-1.5 transition-all disabled:cursor-wait ${take.userVote ===
                              'DOWN'
                              ? 'bg-blue-500 text-white shadow-xs'
                              : 'text-foreground-muted hover:bg-surface hover:text-blue-500'
                            }`}
                          title="Downvote"
                          aria-label="Downvote Hot Take"
                          aria-pressed={
                            take.userVote ===
                            'DOWN'
                          }
                        >
                          <ArrowBigDown className="h-4 w-4 fill-current" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            },
          )}
        </div>
      )}

      {/* Pagination */}
      {hasNextPage && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() =>
              fetchNextPage()
            }
            disabled={
              isFetchingNextPage
            }
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFetchingNextPage && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            {isFetchingNextPage
              ? 'Loading...'
              : 'Load More Takes'}
          </button>
        </div>
      )}

      {/* Report dialog */}
      {reportTargetId && (
        <ReportDialog
          isOpen={true}
          onClose={() =>
            setReportTargetId(null)
          }
          targetId={reportTargetId}
          targetType="HOT_TAKE"
        />
      )}
    </div>
  )
}

/*
 * Reusable metadata input.
 */
interface MetadataInputProps {
  icon: React.ReactNode
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}

function MetadataInput({
  icon,
  value,
  onChange,
  placeholder,
  className = '',
}: MetadataInputProps) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 ${className}`}
    >
      <span className="shrink-0 text-foreground-muted">
        {icon}
      </span>

      <input
        type="text"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        className="min-w-0 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted"
      />
    </div>
  )
}

/*
 * Reusable metadata row.
 */
interface MetadataRowProps {
  icon: React.ReactNode
  value: React.ReactNode
  alignTop?: boolean
}

function MetadataRow({
  icon,
  value,
  alignTop = false,
}: MetadataRowProps) {
  return (
    <div
      className={`flex gap-2 ${alignTop
          ? 'items-start'
          : 'items-center'
        }`}
    >
      <span className="shrink-0 text-foreground-muted">
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        {value}
      </div>
    </div>
  )
}

