import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { messagingApi } from '../../api/messaging'
import { useSocket } from '../../hooks/useSocket'
import { formatDistanceToNow } from 'date-fns'
import {
  Loader2,
  Plus,
  MessageSquare,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useIntersectionObserver } from 'usehooks-ts'
import { Avatar } from '../ui/Avatar'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { NewChatModal } from './NewChatModal'

export function ConversationList() {
  const { messagingSocket } = useSocket()
  const queryClient = useQueryClient()

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')

  /*
   * --------------------------------------------------------------------------
   * Conversations Query
   * --------------------------------------------------------------------------
   */

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['conversations'],
    queryFn: ({ pageParam }) =>
      messagingApi.getConversations({
        cursorAt: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor || undefined,
  })

  /*
   * --------------------------------------------------------------------------
   * Infinite Scroll
   * --------------------------------------------------------------------------
   */

  const { isIntersecting, ref: bottomRef } = useIntersectionObserver({
    threshold: 0.1,
  })

  useEffect(() => {
    if (
      isIntersecting &&
      hasNextPage &&
      !isFetchingNextPage &&
      status !== 'pending'
    ) {
      fetchNextPage()
    }
  }, [
    isIntersecting,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    status,
  ])

  /*
   * --------------------------------------------------------------------------
   * Delete Conversation
   * --------------------------------------------------------------------------
   */

  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) =>
      messagingApi.deleteConversation(conversationId),

    onMutate: (conversationId) => {
      setDeletingId(conversationId)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
      })
    },

    onSettled: () => {
      setDeletingId(null)
    },
  })

  /*
   * --------------------------------------------------------------------------
   * Socket: New Message
   *
   * When a new message arrives:
   * 1. Find the conversation.
   * 2. Update latestMessage.
   * 3. Move that conversation to the top.
   *
   * If the conversation is not currently loaded, invalidate the query so the
   * server can return the correct conversation list.
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    if (!messagingSocket) return

    const handleNewMessage = (payload: any) => {
      const oldData: any = queryClient.getQueryData([
        'conversations',
      ])

      if (!oldData || !Array.isArray(oldData.pages)) {
        queryClient.invalidateQueries({
          queryKey: ['conversations'],
        })
        return
      }

      let found = false

      const updatedPages = oldData.pages.map((page: any) => {
        const items = page.items || []

        const existingIndex = items.findIndex(
          (conversation: any) =>
            conversation.id === payload.conversationId,
        )

        if (existingIndex === -1) {
          return page
        }

        found = true

        const updatedItems = [...items]

        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          latestMessage: payload,
        }

        return {
          ...page,
          items: updatedItems,
        }
      })

      /*
       * Conversation isn't in the currently loaded pages.
       * Let the server provide the correct data.
       */
      if (!found) {
        queryClient.invalidateQueries({
          queryKey: ['conversations'],
        })
        return
      }

      /*
       * Flatten → sort → redistribute into the existing page sizes.
       *
       * This keeps infinite-query pagination intact while ensuring the
       * conversation with the newest message appears first.
       */
      const allItems = updatedPages
        .flatMap((page: any) => page.items || [])
        .filter(Boolean)

      allItems.sort((a: any, b: any) => {
        const timeA = new Date(
          a.latestMessage?.createdAt || 0,
        ).getTime()

        const timeB = new Date(
          b.latestMessage?.createdAt || 0,
        ).getTime()

        return timeB - timeA
      })

      let currentIndex = 0

      const sortedPages = updatedPages.map((page: any) => {
        const pageLength = (page.items || []).length

        const items = allItems.slice(
          currentIndex,
          currentIndex + pageLength,
        )

        currentIndex += pageLength

        return {
          ...page,
          items,
        }
      })

      queryClient.setQueryData(
        ['conversations'],
        (old: any) => {
          if (!old) return old

          return {
            ...old,
            pages: sortedPages,
          }
        },
      )
    }

    messagingSocket.on('message:new', handleNewMessage)

    return () => {
      messagingSocket.off('message:new', handleNewMessage)
    }
  }, [messagingSocket, queryClient])

  /*
   * --------------------------------------------------------------------------
   * Derived Conversation List
   * --------------------------------------------------------------------------
   */

  const conversations = useMemo(() => {
    const query = filterQuery.trim().toLowerCase()

    const allConversations =
      data?.pages
        .flatMap((page) => page.items || [])
        .filter(Boolean) ?? []

    if (!query) {
      return allConversations
    }

    return allConversations.filter((conversation) =>
      conversation.targetUser?.displayName
        ?.toLowerCase()
        .includes(query),
    )
  }, [data, filterQuery])

  /*
   * --------------------------------------------------------------------------
   * Render
   * --------------------------------------------------------------------------
   */

  return (
    <div className="flex h-full w-full flex-col border-r border-border-subtle bg-surface">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}

      <header className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3.5 sm:px-4 sm:py-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Messages
        </h2>

        <button
          type="button"
          onClick={() => setIsNewChatOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-muted active:scale-95"
          title="New Conversation"
          aria-label="New Conversation"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Search                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="shrink-0 border-b border-border-subtle p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
            aria-hidden="true"
          />

          <input
            type="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search messages..."
            aria-label="Search conversations"
            className="hk-input h-10 w-full pl-9 pr-9 text-sm"
          />

          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Conversation List                                                  */}
      {/* ------------------------------------------------------------------ */}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {status === 'pending' ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : status === 'error' ? (
          <ErrorState
            title="Couldn’t load messages"
            description="Please try again in a moment."
            onRetry={() =>
              queryClient.invalidateQueries({
                queryKey: ['conversations'],
              })
            }
          />
        ) : conversations.length === 0 ? (
          filterQuery ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No conversations found"
              description={`No conversations match "${filterQuery}".`}
            />
          ) : (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title="No messages yet"
              description="When you connect with someone, conversations will appear here."
            />
          )
        ) : (
          <ul className="divide-y divide-border-subtle">
            {conversations.map((conv) => {
              const otherUser = conv.targetUser
              const latestMsg = conv.latestMessage
              const isDeleting = deletingId === conv.id
              const unreadCount = conv.unreadCount ?? 0

              const latestMessageTime =
                latestMsg?.createdAt &&
                  !Number.isNaN(
                    new Date(latestMsg.createdAt).getTime(),
                  )
                  ? formatDistanceToNow(
                    new Date(latestMsg.createdAt),
                    {
                      addSuffix: false,
                    },
                  )
                  : null

              const preview =
                latestMsg?.content ||
                (latestMsg?.messageType &&
                  latestMsg.messageType !== 'TEXT'
                  ? `Sent a ${latestMsg.messageType.toLowerCase()}`
                  : 'No messages yet')

              return (
                <li
                  key={conv.id}
                  className="group relative"
                >
                  <Link
                    to="/messages/$conversationId"
                    params={{
                      conversationId: conv.id,
                    }}
                    className="
                      flex min-h-[72px] items-center gap-3
                      px-3.5 py-3 pr-12
                      transition-colors duration-150
                      hover:bg-surface-muted
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-inset
                      focus-visible:ring-primary/40
                      sm:px-4
                    "
                    activeProps={{
                      className:
                        'bg-surface-muted',
                    }}
                  >
                    {/* Avatar */}
                    <Avatar
                      src={otherUser?.avatarUrl}
                      name={
                        otherUser?.displayName ||
                        'User'
                      }
                      size="lg"
                    />

                    {/* Conversation Content */}
                    <div className="min-w-0 flex-1">
                      {/* Name + Time */}
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-[15px]">
                          {otherUser?.displayName ||
                            'Unknown User'}
                        </span>

                        {latestMessageTime && (
                          <span className="shrink-0 whitespace-nowrap text-[11px] text-foreground-muted sm:text-xs">
                            {latestMessageTime}
                          </span>
                        )}
                      </div>

                      {/* Message + Unread Count */}
                      <div className="flex items-center gap-2">
                        <p
                          className={`
                            min-w-0 flex-1 truncate text-sm
                            ${unreadCount > 0
                              ? 'font-semibold text-foreground'
                              : 'text-foreground-muted'
                            }
                          `}
                        >
                          {preview}
                        </p>

                        {unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                            {unreadCount > 99
                              ? '99+'
                              : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      if (
                        deleteConversationMutation.isPending
                      ) {
                        return
                      }

                      const confirmed = window.confirm(
                        'Delete this conversation?',
                      )

                      if (confirmed) {
                        deleteConversationMutation.mutate(
                          conv.id,
                        )
                      }
                    }}
                    disabled={
                      deleteConversationMutation.isPending
                    }
                    className="
                      absolute right-2.5 top-1/2
                      flex h-8 w-8
                      -translate-y-1/2
                      items-center justify-center
                      rounded-lg
                      text-foreground-subtle
                      opacity-0
                      transition-all
                      hover:bg-danger/10
                      hover:text-danger
                      focus-visible:opacity-100
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-danger/30
                      group-hover:opacity-100
                      disabled:cursor-not-allowed
                    "
                    title="Delete Chat"
                    aria-label={`Delete conversation with ${otherUser?.displayName ||
                      'user'
                      }`}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </li>
              )
            })}

            {/* Infinite Scroll Sentinel */}
            <li
              ref={bottomRef}
              className="flex h-12 items-center justify-center"
              aria-hidden="true"
            >
              {isFetchingNextPage && (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
            </li>
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* New Conversation Modal                                             */}
      {/* ------------------------------------------------------------------ */}

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
      />
    </div>
  )
}
