import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useIntersectionObserver } from 'usehooks-ts'
import {
  BarChart2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Grid3X3,
  Heart,
  Image as ImageIcon,
  Layers,
  List,
  MessageCircle,
  Play,
  RefreshCw,
  X,
} from 'lucide-react'

import { postsApi, type PostItem } from '../../api/posts'
import type { UserProfile } from '../../api/profile'
import { PostCard } from '../feed/PostCard'
import { FormattedContent } from '@/components/ui/FormattedContent'

interface Props {
  profile: UserProfile
  isOwnProfile: boolean
}

type TabMode = 'grid' | 'feed' | 'media'

const PAGE_SIZE = 20

export function ProfilePosts({ profile, isOwnProfile }: Props) {
  const [activeTab, setActiveTab] = useState<TabMode>('grid')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  /*
   * Keep the sentinel well ahead of the viewport.
   *
   * The next page starts loading while the user is approaching
   * the bottom instead of waiting until they actually reach it.
   */
  const { isIntersecting: inView, ref: loadMoreRef } =
    useIntersectionObserver({
      threshold: 0,
      rootMargin: '600px 0px',
    })

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery({
    queryKey: ['profile', 'posts', profile.userId],

    queryFn: ({ pageParam }) =>
      postsApi.getUserPosts(profile.userId, {
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),

    initialPageParam: undefined as string | undefined,

    getNextPageParam: (lastPage) =>
      lastPage.nextCursor || undefined,

    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,

    /*
     * Prevent accidental duplicate requests while the user
     * rapidly scrolls or the observer fires multiple times.
     */
    retry: 1,
  })

  /*
   * Automatically fetch the next page when the sentinel
   * approaches the viewport.
   */
  useEffect(() => {
    if (
      !inView ||
      !hasNextPage ||
      isFetchingNextPage ||
      isLoading
    ) {
      return
    }

    void fetchNextPage()
  }, [
    inView,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    fetchNextPage,
  ])

  /*
   * Flatten pages and defensively deduplicate posts.
   *
   * Cursor pagination should normally prevent duplicates, but
   * this protects the UI from overlapping pages during realtime
   * updates, retries, or backend cursor edge cases.
   */
  const posts = useMemo(() => {
    const rawPosts =
      data?.pages.flatMap((page) => page.items ?? []) ?? []

    const uniquePosts = new Map<string, PostItem>()

    for (const post of rawPosts) {
      if (!post?.id) continue

      uniquePosts.set(post.id, {
        ...post,

        /*
         * Some profile-post endpoints may not return complete
         * author information. Fall back to the profile data.
         */
        author: post.author || {
          id: profile.userId,
          userId: profile.userId,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          isVerifiedIdentity: profile.isVerifiedIdentity,
          adminHandle: profile.adminHandle,
          department: profile.department,
        },
      })
    }

    return Array.from(uniquePosts.values())
  }, [data, profile])

  /*
   * Only posts containing media belong to the MEDIA tab.
   */
  const mediaPosts = useMemo(
    () => posts.filter((post) => (post.media ?? []).length > 0),
    [posts],
  )

  const displayedPosts = useMemo(
    () => (activeTab === 'media' ? mediaPosts : posts),
    [activeTab, mediaPosts, posts],
  )

  /*
   * If pagination changes the displayed array while the modal
   * is open, make sure the selected index never points at an
   * invalid post.
   */
  useEffect(() => {
    if (selectedIndex === null) return

    if (
      displayedPosts.length === 0 ||
      selectedIndex >= displayedPosts.length
    ) {
      setSelectedIndex(null)
    }
  }, [displayedPosts.length, selectedIndex])

  const selectedPost =
    selectedIndex !== null
      ? displayedPosts[selectedIndex]
      : undefined

  /*
   * Load another page when the user reaches the final currently
   * loaded post from inside the modal.
   *
   * This matters because the modal can be opened before the next
   * page has been fetched.
   */
  const handleNextPost = useCallback(() => {
    if (selectedIndex === null) return

    const isLastLoadedPost =
      selectedIndex >= displayedPosts.length - 1

    if (isLastLoadedPost) {
      if (hasNextPage && !isFetchingNextPage) {
        void fetchNextPage()
      }

      return
    }

    setSelectedIndex((current) =>
      current === null ? null : current + 1,
    )
  }, [
    selectedIndex,
    displayedPosts.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  const handlePrevPost = useCallback(() => {
    if (selectedIndex === null || selectedIndex <= 0) return

    setSelectedIndex((current) =>
      current === null ? null : current - 1,
    )
  }, [selectedIndex])

  /*
   * Keyboard navigation and body scroll lock.
   */
  useEffect(() => {
    if (selectedIndex === null) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          setSelectedIndex(null)
          break

        case 'ArrowRight':
          event.preventDefault()
          handleNextPost()
          break

        case 'ArrowLeft':
          event.preventDefault()
          handlePrevPost()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedIndex, handleNextPost, handlePrevPost])

  /*
   * Initial loading state.
   *
   * Since GRID is the default tab, show a grid-shaped skeleton
   * rather than a feed skeleton that doesn't match the final UI.
   */
  if (isLoading) {
    return (
      <div className="mt-6 flex flex-col gap-6">
        <ProfilePostsTabsSkeleton />

        <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="aspect-square animate-pulse rounded-lg sm:rounded-xl bg-surface-muted border border-border-subtle"
            />
          ))}
        </div>
      </div>
    )
  }

  /*
   * Initial request failure.
   */
  if (isError) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface-elevated p-10 sm:p-12 text-center shadow-xs">
        <FileText className="mx-auto mb-3 h-8 w-8 text-foreground-muted/60" />

        <h3 className="text-lg font-semibold text-foreground">
          Failed to load posts
        </h3>

        <p className="mt-2 text-sm text-foreground-muted">
          {error instanceof Error
            ? error.message
            : 'Please try again later.'}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border px-1">
        <div className="flex items-center gap-5 sm:gap-8">
          <ProfileTab
            active={activeTab === 'grid'}
            icon={<Grid3X3 className="h-4 w-4" />}
            label="GRID"
            onClick={() => {
              setActiveTab('grid')
              setSelectedIndex(null)
            }}
          />

          <ProfileTab
            active={activeTab === 'feed'}
            icon={<List className="h-4 w-4" />}
            label="FEED"
            onClick={() => {
              setActiveTab('feed')
              setSelectedIndex(null)
            }}
          />

          <ProfileTab
            active={activeTab === 'media'}
            icon={<ImageIcon className="h-4 w-4" />}
            label={
              <>
                <span className="hidden sm:inline">MEDIA</span>
                <span className="sm:hidden">MEDIA</span>
                <span> ({mediaPosts.length})</span>
              </>
            }
            onClick={() => {
              setActiveTab('media')
              setSelectedIndex(null)
            }}
          />
        </div>

        <span className="hidden sm:inline-block text-xs font-medium text-foreground-muted">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'}
        </span>
      </div>

      {/* Empty State */}
      {displayedPosts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-elevated/50 p-10 sm:p-12 text-center shadow-xs">
          <FileText className="mx-auto mb-3 h-8 w-8 text-foreground-muted/60" />

          <h3 className="text-base font-semibold text-foreground">
            No posts to display
          </h3>

          <p className="mt-1 text-sm text-foreground-muted">
            {isOwnProfile
              ? activeTab === 'media'
                ? "You haven't posted any photos or videos yet."
                : "You haven't posted anything yet."
              : "This user hasn't posted anything yet."}
          </p>
        </div>
      ) : activeTab === 'feed' ? (
        /* Feed */
        <div className="flex flex-col gap-6">
          {displayedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
            />
          ))}
        </div>
      ) : (
        /* Grid / Media */
        <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-3">
          {displayedPosts.map((post, index) => {
            const media = post.media ?? []
            const firstMedia = media[0]
            const hasMedia = media.length > 0
            const isVideo = firstMedia?.type === 'VIDEO'
            const hasMultipleMedia = media.length > 1
            const isPoll = Boolean((post as any).poll)

            return (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg sm:rounded-xl border border-border-subtle bg-surface-elevated text-left transition-all hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`Open post ${index + 1}`}
              >
                {hasMedia && firstMedia ? (
                  <>
                    {isVideo ? (
                      <video
                        src={firstMedia.url}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={firstMedia.url}
                        alt="Post media thumbnail"
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}

                    {/* Media badges */}
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1 sm:right-2 sm:top-2">
                      {isVideo && (
                        <div className="rounded-full bg-black/60 p-1 text-white backdrop-blur-md sm:p-1.5">
                          <Play className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
                        </div>
                      )}

                      {hasMultipleMedia && (
                        <div className="rounded-full bg-black/60 p-1 text-white backdrop-blur-md sm:p-1.5">
                          <Layers className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </div>
                      )}
                    </div>

                    {/* Hover statistics */}
                    <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/55 text-xs font-bold text-white opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100 sm:gap-6 sm:text-base">
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${post.isLikedByViewer ? 'fill-rose-500 text-rose-500' : 'fill-current'}`} />
                        <span>{post.likesCount}</span>
                      </div>

                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <MessageCircle className="h-4 w-4 fill-current sm:h-5 sm:w-5" />
                        <span>{post.commentsCount}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Text / Poll tile */
                  <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-surface-elevated via-surface-muted/50 to-primary/5 p-2.5 transition-all group-hover:to-primary/10 sm:p-3.5">
                    <div className="min-w-0 space-y-1">
                      {isPoll && (
                        <div className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary sm:text-[10px]">
                          <BarChart2 className="h-2.5 w-2.5" />
                          POLL
                        </div>
                      )}

                      <div className="line-clamp-4 text-[11px] font-medium leading-snug text-foreground sm:text-xs">
                        <FormattedContent content={post.content || ''} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border-subtle pt-1.5 text-[10px] text-foreground-muted sm:text-xs">
                      <span className="flex items-center gap-0.5 font-semibold">
                        <Heart
                          className={`h-3 w-3 ${post.isLikedByViewer
                            ? 'fill-rose-500 text-rose-500'
                            : ''
                            }`}
                        />
                        {post.likesCount}
                      </span>

                      <span className="flex items-center gap-0.5 font-semibold">
                        <MessageCircle className="h-3 w-3" />
                        {post.commentsCount}
                      </span>
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Infinite-scroll sentinel */}
      {hasNextPage && (
        <div
          ref={loadMoreRef}
          className="flex min-h-14 w-full items-center justify-center py-4"
          aria-live="polite"
        >
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-sm text-foreground-muted">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading more posts...
            </div>
          ) : isFetchNextPageError ? (
            <button
              type="button"
              onClick={() => void (fetchNextPage as () => Promise<unknown>)()}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Retry loading posts
            </button>
          ) : (
            <span className="text-xs text-foreground-muted/70">
              Loading more as you scroll...
            </span>
          )}
        </div>
      )}

      {/* End of feed indicator */}
      {!hasNextPage && posts.length > 0 && (
        <div className="py-4 text-center">
          <span className="text-xs text-foreground-muted/60">
            You've reached the end
          </span>
        </div>
      )}

      {/* Modal */}
      {selectedPost && selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 backdrop-blur-md animate-in fade-in duration-150 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Post viewer"
        >
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 cursor-default"
            onClick={() => setSelectedIndex(null)}
            aria-label="Close post viewer"
          />

          {/* Previous */}
          {selectedIndex > 0 && (
            <button
              type="button"
              onClick={handlePrevPost}
              className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow-lg transition-all hover:bg-black/80 cursor-pointer sm:left-6 sm:p-3"
              title="Previous post"
              aria-label="Previous post"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}

          {/* Next */}
          {(selectedIndex < displayedPosts.length - 1 ||
            hasNextPage) && (
              <button
                type="button"
                onClick={handleNextPost}
                disabled={isFetchingNextPage}
                className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow-lg transition-all hover:bg-black/80 disabled:cursor-wait disabled:opacity-60 cursor-pointer sm:right-6 sm:p-3"
                title="Next post"
                aria-label="Next post"
              >
                {isFetchingNextPage &&
                  selectedIndex >= displayedPosts.length - 1 ? (
                  <RefreshCw className="h-5 w-5 animate-spin sm:h-6 sm:w-6" />
                ) : (
                  <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </button>
            )}

          {/* Modal content */}
          <div className="relative z-20 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-surface p-2 shadow-2xl [scrollbar-width:thin] sm:p-4">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between border-b border-border px-2 pb-3">
              <span className="text-xs font-semibold text-foreground-muted">
                Post {selectedIndex + 1}
                {hasNextPage
                  ? ''
                  : ` of ${displayedPosts.length}`}
              </span>

              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="rounded-full bg-surface-muted p-1.5 text-foreground-muted transition-colors hover:bg-surface-elevated hover:text-foreground cursor-pointer"
                title="Close"
                aria-label="Close post viewer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <PostCard post={selectedPost} key={selectedPost.id} />
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Reusable tab component                                                      */
/* -------------------------------------------------------------------------- */

interface ProfileTabProps {
  active: boolean
  icon: React.ReactNode
  label: React.ReactNode
  onClick: () => void
}

function ProfileTab({
  active,
  icon,
  label,
  onClick,
}: ProfileTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 py-3 text-sm font-semibold transition-colors cursor-pointer ${active
        ? 'text-primary'
        : 'text-foreground-muted hover:text-foreground'
        }`}
    >
      {icon}
      <span>{label}</span>

      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
      )}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Grid-shaped initial loading skeleton                                        */
/* -------------------------------------------------------------------------- */

function ProfilePostsTabsSkeleton() {
  return (
    <div className="flex items-center justify-between border-b border-border px-1">
      <div className="flex items-center gap-5 sm:gap-8">
        <div className="h-10 w-16 animate-pulse rounded-t-lg bg-muted/40 sm:w-20" />
        <div className="h-10 w-16 animate-pulse rounded-t-lg bg-muted/30 sm:w-20" />
        <div className="h-10 w-20 animate-pulse rounded-t-lg bg-muted/30 sm:w-24" />
      </div>

      <div className="hidden h-4 w-16 animate-pulse rounded bg-muted/30 sm:block" />
    </div>
  )
}
