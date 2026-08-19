import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { messagingApi } from '../../api/messaging'
import { useSocket } from '../../hooks/useSocket'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Plus, MessageSquare, Search } from 'lucide-react'
import { useIntersectionObserver } from 'usehooks-ts'

export function ConversationList() {
  const { isConnected, messagingSocket } = useSocket()
  const queryClient = useQueryClient()
  
  // Handle reconnect logic: refetch when connection is restored
  useEffect(() => {
    if (isConnected.messaging) {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  }, [isConnected.messaging, queryClient])
  
  // To handle the active state highlight
  // We use standard React Router hooks if needed, but <Link activeProps> is easier.
  // We can just use the Link component directly.
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['conversations'],
    queryFn: ({ pageParam }) => messagingApi.getConversations({ cursorAt: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
  })

  const { isIntersecting, ref: bottomRef } = useIntersectionObserver({
    threshold: 0.1,
  })

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Real-time updates for conversation list
  useEffect(() => {
    if (!messagingSocket) return

    const handleNewMessage = () => {
      // Invalidate to fetch latest previews and sort order
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }

    messagingSocket.on('message:new', handleNewMessage)

    return () => {
      messagingSocket.off('message:new', handleNewMessage)
    }
  }, [messagingSocket, queryClient])

  const conversations = data?.pages.flatMap((page) => page.items || []) ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="font-bold text-xl text-foreground">Messages</h2>
        <button 
          className="p-2 rounded-full hover:bg-surface-muted text-foreground transition-colors"
          title="New Conversation"
          // TODO: Open modal to search and select user to chat with
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Search (Placeholder) */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <input 
            type="text" 
            placeholder="Search messages..." 
            className="w-full bg-surface-muted text-sm rounded-full pl-9 pr-4 py-2 border-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-foreground-muted outline-none transition-shadow"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {status === 'pending' ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <p className="text-sm text-danger font-medium mb-2">Failed to load messages</p>
            <button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['conversations'] })}
              className="text-xs text-primary hover:underline"
            >
              Try Again
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-foreground-muted">
            <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-sm">No messages yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {conversations.map((conv) => {
              const otherUser = conv.targetUser
              const latestMsg = conv.latestMessage

              return (
                <li key={conv.id}>
                  <Link
                    to="/messages/$conversationId"
                    params={{ conversationId: conv.id }}
                    className="flex items-center gap-3 p-3 hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:bg-surface-muted"
                    activeProps={{ className: 'bg-surface-muted relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary' }}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {otherUser?.avatarUrl ? (
                        <img src={otherUser.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <span className="text-lg font-medium">
                            {otherUser?.displayName?.[0] || '?'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-foreground truncate">
                          {otherUser?.displayName || 'Unknown User'}
                        </span>
                        {latestMsg && (
                          <span className="text-xs text-foreground-muted shrink-0 whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(latestMsg.createdAt), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${conv.unreadCount ? 'font-semibold text-foreground' : 'text-foreground-muted'}`}>
                          {latestMsg?.content || (latestMsg?.messageType !== 'TEXT' ? `Sent a ${latestMsg?.messageType.toLowerCase()}` : 'No messages yet')}
                        </p>
                        {!!conv.unreadCount && conv.unreadCount > 0 && (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
            <div ref={bottomRef} className="h-10 flex items-center justify-center">
              {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>
          </ul>
        )}
      </div>
    </div>
  )
}
