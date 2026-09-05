import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messagingApi } from '../../api/messaging'
import { useSocket } from '../../hooks/useSocket'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Plus, MessageSquare, Search, Trash2 } from 'lucide-react'
import { useIntersectionObserver } from 'usehooks-ts'
import { Avatar } from '../ui/Avatar'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { NewChatModal } from './NewChatModal'

export function ConversationList() {
  const { isConnected, messagingSocket } = useSocket()
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')

  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) => messagingApi.deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setDeletingId(null)
    }
  })

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
    if (isIntersecting && hasNextPage && !isFetchingNextPage && status !== 'pending') {
      fetchNextPage()
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage, status])

  useEffect(() => {
    if (!messagingSocket) return

    const handleNewMessage = (payload: any) => {
      const oldData: any = queryClient.getQueryData(['conversations'])
      if (!oldData || !Array.isArray(oldData.pages)) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        return
      }
      
      let found = false
      const newPages = oldData.pages.map((page: any) => {
        const items = page.items || []
        const existingIndex = items.findIndex((c: any) => c.id === payload.conversationId)
        
        if (existingIndex !== -1) {
          found = true
          const updatedItems = [...items]
          const updatedConv = {
            ...updatedItems[existingIndex],
            latestMessage: payload
          }
          updatedItems[existingIndex] = updatedConv
          return { ...page, items: updatedItems, updatedConv }
        }
        return page
      })
      
      if (!found) {
        queryClient.invalidateQueries({ 
          queryKey: ['conversations']
        })
        return
      }

      queryClient.setQueryData(['conversations'], (old: any) => {
        if (!old) return old
        const allItems = newPages.flatMap((page: any) => page.items || [])
        allItems.sort((a: any, b: any) => {
          const timeA = new Date(a.latestMessage?.createdAt || 0).getTime()
          const timeB = new Date(b.latestMessage?.createdAt || 0).getTime()
          return timeB - timeA
        })

        let currentIdx = 0
        const sortedPages = newPages.map((page: any) => {
          const pageLength = (page.items || []).length
          const items = allItems.slice(currentIdx, currentIdx + pageLength)
          currentIdx += pageLength
          return { ...page, items }
        })
        
        return { ...old, pages: sortedPages }
      })
    }

    messagingSocket.on('message:new', handleNewMessage)

    return () => {
      messagingSocket.off('message:new', handleNewMessage)
    }
  }, [messagingSocket, queryClient])

  const conversations = (data?.pages.flatMap((page) => page.items || []) ?? []).filter(Boolean).filter((conv) => 
    conv.targetUser?.displayName?.toLowerCase().includes(filterQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border-subtle w-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border-subtle flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-xl tracking-tight text-foreground">Messages</h2>
        <button 
          onClick={() => setIsNewChatOpen(true)}
          className="p-2 rounded-full hover:bg-surface-muted text-foreground transition-colors cursor-pointer"
          title="New Conversation"
          aria-label="New Conversation"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border-subtle shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
          <input 
            type="text" 
            placeholder="Search messages..." 
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="hk-input h-10 pl-9 text-sm"
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
          <ErrorState
            title="Couldn’t load messages"
            description="Please try again in a moment."
            onRetry={() => queryClient.invalidateQueries({ queryKey: ['conversations'] })}
          />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-5 w-5" />}
            title="No messages yet"
            description="When you connect with someone, conversations will appear here."
          />
        ) : (
          <ul>
            {conversations.map((conv) => {
              const otherUser = conv.targetUser
              const latestMsg = conv.latestMessage

              return (
                <li key={conv.id} className="group relative">
                  <Link
                    to="/messages/$conversationId"
                    params={{ conversationId: conv.id }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors duration-150 focus-visible:outline-none focus-visible:bg-surface-muted pr-10"
                    activeProps={{ className: 'bg-surface-muted' }}
                  >
                    <Avatar src={otherUser?.avatarUrl} name={otherUser?.displayName || 'User'} size="lg" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-foreground truncate">
                          {otherUser?.displayName || 'Unknown User'}
                        </span>
                        {latestMsg && latestMsg.createdAt && !isNaN(new Date(latestMsg.createdAt).getTime()) && (
                          <span className="text-xs text-foreground-muted shrink-0 whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(latestMsg.createdAt), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${conv.unreadCount ? 'font-semibold text-foreground' : 'text-foreground-muted'}`}>
                          {latestMsg?.content || (latestMsg?.messageType && latestMsg.messageType !== 'TEXT' ? `Sent a ${latestMsg?.messageType.toLowerCase()}` : 'No messages yet')}
                        </p>
                        {!!conv.unreadCount && conv.unreadCount > 0 && (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (confirm('Delete this conversation?')) {
                        deleteConversationMutation.mutate(conv.id)
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-foreground-subtle hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Delete Chat"
                    aria-label="Delete Chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
            <div ref={bottomRef} className="h-10 flex items-center justify-center">
              {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>
          </ul>
        )}
      </div>
      {/* New Conversation Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
      />
    </div>
  )
}
