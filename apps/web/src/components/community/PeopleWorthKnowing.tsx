import { useEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { communityApi } from '../../api/community'
import { Sparkles, User } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { VerifiedBadge } from '../ui/VerifiedBadge'
import { isUserVerified } from '@/utils/user'

export function PeopleWorthKnowing() {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['people-worth-knowing'],
    queryFn: ({ pageParam }) =>
      communityApi.getRecommendations({
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.nextCursorAt || undefined,
    staleTime: 5 * 60 * 1000,
  })

  const recommendations =
    data?.pages.flatMap((page) => page.items ?? []) ?? []

  /*
   * Automatically fetch the next page when the sentinel
   * approaches the viewport/end of the horizontal rail.
   */
  useEffect(() => {
    const sentinel = loadMoreRef.current

    if (!sentinel || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]

        if (
          entry.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          fetchNextPage()
        }
      },
      {
        /*
         * Since this is a horizontal scroll container,
         * start loading before the user reaches the end.
         */
        rootMargin: '0px 300px 0px 0px',
        threshold: 0.01,
      },
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  /*
   * Initial loading state.
   *
   * Skeleton dimensions intentionally match the real cards:
   * mobile: 190px
   * desktop: 215px
   */
  if (isLoading) {
    return (
      <section aria-label="People Worth Knowing">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />

          <h2 className="text-lg font-bold text-foreground">
            People Worth Knowing
          </h2>
        </div>

        <div
          className="
            -mx-4 flex gap-3 overflow-hidden
            px-4 pb-4
            sm:mx-0 sm:px-0
          "
          aria-hidden="true"
        >
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="
                flex h-[236px]
                w-[190px] min-w-[190px]
                shrink-0 flex-col
                rounded-2xl border border-border
                bg-surface-muted p-4
                sm:h-[252px]
                sm:w-[215px] sm:min-w-[215px]
                sm:p-5
              "
            >
              {/* Avatar skeleton */}
              <div className="mx-auto mb-3 h-16 w-16 shrink-0 animate-pulse rounded-full bg-surface" />

              {/* Name skeleton */}
              <div className="mx-auto h-4 w-28 animate-pulse rounded-md bg-surface" />

              {/* Headline skeleton */}
              <div className="mt-2 space-y-1.5">
                <div className="mx-auto h-3 w-36 animate-pulse rounded bg-surface" />
                <div className="mx-auto h-3 w-24 animate-pulse rounded bg-surface" />
              </div>

              {/* Reason skeleton */}
              <div className="mt-3 h-6 w-full animate-pulse rounded-md bg-surface" />

              {/* Button skeleton */}
              <div className="mt-auto h-9 w-full animate-pulse rounded-xl bg-surface" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (error || recommendations.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby="people-worth-knowing-heading"
      className="w-full min-w-0"
    >
      {/* Section Header */}
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />

        <h2
          id="people-worth-knowing-heading"
          className="text-lg font-bold text-foreground"
        >
          People Worth Knowing
        </h2>
      </div>

      {/* Horizontal Recommendation Rail */}
      <div
        className="
          -mx-4 flex gap-3 overflow-x-auto
          px-4 pb-4
          scrollbar-hide
          snap-x snap-mandatory
          overscroll-x-contain
          sm:mx-0 sm:px-0
        "
      >
        {recommendations.map((person) => {
          const username = person.username || person.id
          const displayName = person.displayName || 'Student'
          const initial = displayName.charAt(0).toUpperCase()

          return (
            <article
              key={person.id}
              className="
                flex w-[190px] min-w-[190px]
                shrink-0 snap-start
                flex-col
                rounded-2xl border border-border
                bg-surface-muted p-4
                transition-all duration-200
                hover:border-primary/30
                hover:shadow-sm
                sm:w-[215px] sm:min-w-[215px]
                sm:p-5
              "
            >
              {/* Profile */}
              <Link
                to="/profile/$username"
                params={{ username }}
                className="
                  group flex min-w-0 flex-col items-center
                  rounded-xl
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-primary
                  focus-visible:ring-offset-2
                "
                aria-label={`View ${displayName}'s profile`}
              >
                {/* Avatar */}
                <div className="relative mb-3">
                  {person.avatarUrl ? (
                    <img
                      src={person.avatarUrl}
                      alt={`${displayName}'s profile`}
                      loading="lazy"
                      decoding="async"
                      width={64}
                      height={64}
                      className="
                        h-16 w-16 rounded-full object-cover
                        ring-2 ring-surface
                        transition-all duration-200
                        group-hover:ring-primary
                      "
                    />
                  ) : (
                    <div
                      className="
                        flex h-16 w-16 items-center
                        justify-center rounded-full
                        bg-primary/10 text-primary
                        ring-2 ring-surface
                        transition-all duration-200
                        group-hover:ring-primary
                      "
                      aria-hidden="true"
                    >
                      <span className="text-xl font-semibold">
                        {initial}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name + Verified */}
                <div className="flex w-full min-w-0 items-center justify-center gap-1">
                  <h3
                    className="
                      min-w-0 truncate text-center
                      text-sm font-semibold text-foreground
                    "
                  >
                    {displayName}
                  </h3>

                  {isUserVerified(person) && (
                    <VerifiedBadge />
                  )}
                </div>

                {/* Headline */}
                <p
                  className="
                    mt-1 min-h-[32px] w-full
                    text-center text-xs leading-4
                    text-foreground-muted
                    line-clamp-2
                  "
                >
                  {person.headline ||
                    `${person.campus || 'SRM'} Student`}
                </p>
              </Link>

              {/* Recommendation Reason */}
              {person.reasons?.length > 0 ? (
                <div
                  className="
                    mt-3 min-h-[24px] w-full
                    truncate rounded-md bg-surface
                    px-2 py-1
                    text-center text-[10px]
                    font-medium text-foreground-muted
                  "
                  title={person.reasons[0]}
                >
                  {person.reasons[0]}
                </div>
              ) : (
                /*
                 * Keep card height consistent even when
                 * a recommendation has no reason.
                 */
                <div className="mt-3 min-h-[24px]" />
              )}

              {/* View Profile */}
              <Link
                to="/profile/$username"
                params={{ username }}
                className="
                  mt-auto flex w-full
                  items-center justify-center gap-1.5
                  rounded-xl
                  bg-primary/10
                  px-3 py-2
                  text-xs font-semibold
                  text-primary
                  transition-all duration-200
                  hover:bg-primary
                  hover:text-primary-foreground
                  active:scale-[0.98]
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-primary
                  focus-visible:ring-offset-2
                  sm:gap-2 sm:text-sm
                "
              >
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                View Profile
              </Link>
            </article>
          )
        })}

        {/* Infinite Scroll Sentinel */}
        {hasNextPage && (
          <div
            ref={loadMoreRef}
            className="
              flex w-8 min-w-8
              shrink-0 snap-start
              items-center justify-center
            "
            aria-hidden="true"
          >
            {isFetchingNextPage && (
              <div
                className="
                  h-5 w-5 animate-spin
                  rounded-full border-2
                  border-primary/20
                  border-t-primary
                "
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

