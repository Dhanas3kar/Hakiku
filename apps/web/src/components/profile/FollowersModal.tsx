import { useState, useMemo } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { networkingApi } from '../../api/networking'
import type { FollowUserItem } from '../../api/networking'
import { useAuth } from '../../hooks/useAuth'
import { X, Search, User, UserPlus, UserCheck, Loader2 } from 'lucide-react'
import { VerifiedBadge } from '../ui/VerifiedBadge'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

interface Props {
  userId: string
  initialTab?: 'followers' | 'following'
  followersCount?: number
  followingCount?: number
  onClose: () => void
}

export function FollowersModal({
  userId,
  initialTab = 'followers',
  followersCount,
  followingCount,
  onClose,
}: Props) {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')

  // Infinite query for Followers
  const followersQuery = useInfiniteQuery({
    queryKey: ['followers-list', userId],
    queryFn: ({ pageParam }) =>
      networkingApi.getFollowers(userId, { cursor: pageParam, limit: 20 }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: activeTab === 'followers' && !!userId,
  })

  // Infinite query for Following
  const followingQuery = useInfiniteQuery({
    queryKey: ['following-list', userId],
    queryFn: ({ pageParam }) =>
      networkingApi.getFollowing(userId, { cursor: pageParam, limit: 20 }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: activeTab === 'following' && !!userId,
  })

  const activeQuery = activeTab === 'followers' ? followersQuery : followingQuery
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = activeQuery

  // Flattened users array
  const allUsers = useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap((page) => page.data)
  }, [data])

  // Filtered users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers
    const q = searchQuery.toLowerCase().trim()
    return allUsers.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q) ||
        u.bio?.toLowerCase().includes(q)
    )
  }, [allUsers, searchQuery])

  // Handle navigate to profile
  const handleUserClick = (username?: string) => {
    if (username) {
      onClose()
      navigate({ to: `/profile/$username`, params: { username } })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Modal Backdrop click listener */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface-elevated/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] z-10 animate-in zoom-in-95 duration-200">
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 shrink-0">
          <div className="flex items-center gap-1 font-semibold text-lg text-foreground">
            <span>{activeTab === 'followers' ? 'Followers' : 'Following'}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Headers (Followers / Following) */}
        <div className="flex border-b border-border/80 shrink-0 bg-surface-muted/30">
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'followers'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-foreground-muted hover:text-foreground hover:bg-surface-muted/50'
            }`}
          >
            Followers {followersCount !== undefined ? `(${followersCount})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'following'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-foreground-muted hover:text-foreground hover:bg-surface-muted/50'
            }`}
          >
            Following {followingCount !== undefined ? `(${followingCount})` : ''}
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2.5 border-b border-border/60 shrink-0">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-foreground-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-surface-muted/60 pl-9 pr-8 py-1.5 text-sm text-foreground placeholder:text-foreground-muted/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-foreground-muted hover:text-foreground p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* User List Content */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-border/20">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-foreground-muted space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Loading {activeTab}...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-foreground-muted space-y-2">
              <div className="rounded-full bg-surface-muted p-3">
                <User className="h-6 w-6 opacity-60" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {searchQuery
                  ? 'No matching users found'
                  : activeTab === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone yet'}
              </p>
              {searchQuery && (
                <p className="text-xs text-foreground-muted">
                  Try searching for another username or display name
                </p>
              )}
            </div>
          ) : (
            <>
              {filteredUsers.map((userItem) => (
                <UserItemRow
                  key={userItem.userId}
                  item={userItem}
                  currentUserId={currentUser?.id}
                  onNavigate={handleUserClick}
                />
              ))}

              {/* Load More Button */}
              {hasNextPage && (
                <div className="py-3 text-center pt-2">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Loading more...</span>
                      </>
                    ) : (
                      <span>Load more</span>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function UserItemRow({
  item,
  currentUserId,
  onNavigate,
}: {
  item: FollowUserItem
  currentUserId?: string
  onNavigate: (username?: string) => void
}) {
  const isMe = item.userId === currentUserId
  const queryClient = useQueryClient()

  // Track follow mutation state locally for instant toggle
  const [isFollowingState, setIsFollowingState] = useState<boolean | null>(null)

  const followMutation = useMutation({
    mutationFn: () => networkingApi.followUser(item.userId),
    onMutate: () => {
      setIsFollowingState(true)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers-list'] })
      queryClient.invalidateQueries({ queryKey: ['following-list'] })
      queryClient.invalidateQueries({ queryKey: ['relationship', item.userId] })
      toast.success(`Following @${item.username || 'user'}`)
    },
    onError: () => {
      setIsFollowingState(null)
      toast.error('Failed to follow user')
    },
  })

  const unfollowMutation = useMutation({
    mutationFn: () => networkingApi.unfollowUser(item.userId),
    onMutate: () => {
      setIsFollowingState(false)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers-list'] })
      queryClient.invalidateQueries({ queryKey: ['following-list'] })
      queryClient.invalidateQueries({ queryKey: ['relationship', item.userId] })
      toast.info(`Unfollowed @${item.username || 'user'}`)
    },
    onError: () => {
      setIsFollowingState(null)
      toast.error('Failed to unfollow user')
    },
  })

  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-muted/60 transition-colors group">
      {/* Avatar & User Info */}
      <div
        onClick={() => onNavigate(item.username)}
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
      >
        <div className="relative h-11 w-11 shrink-0 rounded-full bg-surface-muted overflow-hidden border border-border/60">
          {item.avatarUrl ? (
            <img
              src={item.avatarUrl}
              alt={item.displayName || 'User'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-foreground-muted">
              <User className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {item.displayName || item.username || 'User'}
            </span>
            {item.isVerifiedIdentity && (
              <VerifiedBadge className="h-4 w-4 shrink-0 text-primary" />
            )}
          </div>
          <span className="block text-xs text-foreground-muted truncate">
            @{item.username || 'user'}
          </span>
          {item.bio && (
            <p className="text-xs text-foreground-muted/80 truncate mt-0.5 max-w-[220px]">
              {item.bio}
            </p>
          )}
        </div>
      </div>

      {/* Action Button */}
      {!isMe && item.username && (
        <div className="ml-2 shrink-0">
          {isFollowingState === true ? (
            <button
              onClick={() => unfollowMutation.mutate()}
              disabled={unfollowMutation.isPending}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-surface-muted text-foreground hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-all cursor-pointer"
            >
              Following
            </button>
          ) : isFollowingState === false ? (
            <button
              onClick={() => followMutation.mutate()}
              disabled={followMutation.isPending}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
            >
              Follow
            </button>
          ) : (
            <button
              onClick={() => onNavigate(item.username)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-surface-muted text-foreground hover:bg-surface-elevated transition-all cursor-pointer"
            >
              View
            </button>
          )}
        </div>
      )}

      {isMe && (
        <span className="ml-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-muted text-foreground-muted border border-border/40 shrink-0">
          You
        </span>
      )}
    </div>
  )
}
