import { useState } from 'react'
import { getApiBaseUrl } from '../../api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '../../api/profile'
import { networkingApi } from '../../api/networking'
import { messagingApi } from '../../api/messaging'
import { useAuth } from '../../hooks/useAuth'
import { X, Search, User, MessageSquare, Loader2 } from 'lucide-react'
import { VerifiedBadge } from '../ui/VerifiedBadge'
import { isUserVerified } from '../../utils/user'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelectConversation?: (conversationId: string) => void
}

export function NewChatModal({ isOpen, onClose, onSelectConversation }: Props) {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')

  // Search profiles query
  const searchProfilesQuery = useQuery({
    queryKey: ['search-profiles-chat', searchQuery],
    queryFn: () => profileApi.searchProfiles({ query: searchQuery, limit: 15 }),
    enabled: isOpen && searchQuery.trim().length > 0,
  })

  // Following list query as default suggestions when search is empty
  const followingQuery = useQuery({
    queryKey: ['following-suggestions', currentUser?.id],
    queryFn: () => networkingApi.getFollowing(currentUser?.id || '', { limit: 20 }),
    enabled: isOpen && !searchQuery.trim() && !!currentUser?.id,
  })

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: (targetUserId: string) => messagingApi.createConversation(targetUserId),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversation opened')
      onClose()
      if (onSelectConversation) {
        onSelectConversation(newConv.id)
      } else {
        navigate({ to: '/messages/$conversationId', params: { conversationId: newConv.id } })
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to start conversation'
      toast.error(msg)
    },
  })

  if (!isOpen) return null

  const isSearching = searchQuery.trim().length > 0
  const searchResults = searchProfilesQuery.data?.items || []
  const followingResults = followingQuery.data?.data || []

  const displayList = isSearching
    ? searchResults.filter((p) => p.userId !== currentUser?.id)
    : followingResults.filter((f) => f.userId !== currentUser?.id)

  const isLoading = isSearching ? searchProfilesQuery.isLoading : followingQuery.isLoading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface-elevated/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2 font-semibold text-lg text-foreground">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span>New Message</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-border/60 shrink-0">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-foreground-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search people by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-border/80 bg-surface-muted/60 pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-foreground-muted/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
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
              <p className="text-xs">Searching users...</p>
            </div>
          ) : displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-foreground-muted space-y-2">
              <div className="rounded-full bg-surface-muted p-3">
                <User className="h-6 w-6 opacity-60" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {searchQuery ? 'No matching users found' : 'No connections to display'}
              </p>
              <p className="text-xs text-foreground-muted">
                {searchQuery
                  ? 'Try searching with a different keyword or username'
                  : 'Start typing a name above to search for people'}
              </p>
            </div>
          ) : (
            displayList.map((user: any) => {
              const targetUserId = user.userId || user.id
              const displayName = user.displayName || user.fullName || user.username || 'User'
              const username = user.username || ''
              const avatarUrl = user.avatarUrl || (user.avatarKey ? `${getApiBaseUrl()}/uploads/${user.avatarKey}` : null)
              const isVerified = Boolean(user.isVerifiedIdentity) || isUserVerified(user)

              return (
                <div
                  key={targetUserId}
                  onClick={() => createConversationMutation.mutate(targetUserId)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-muted/60 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative h-11 w-11 shrink-0 rounded-full bg-surface-muted overflow-hidden border border-border/60">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={displayName}
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
                          {displayName}
                        </span>
                        {isVerified && (
                          <VerifiedBadge className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </div>
                      <span className="block text-xs text-foreground-muted truncate">
                        @{username}
                      </span>
                    </div>
                  </div>

                  <button
                    disabled={createConversationMutation.isPending}
                    className="ml-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
                  >
                    {createConversationMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Chat'
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
