import React, { useState, useEffect } from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messagingApi } from '../../api/messaging'
import type { MessageItem } from '../../api/messaging'
import { useSocket } from '../../hooks/useSocket'
import { useAuth } from '../../hooks/useAuth'
import { format } from 'date-fns'
import { Loader2, Send, Image as ImageIcon, ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useIntersectionObserver } from 'usehooks-ts'

// --- Zero-Crash Utilities ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode, fallback?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return this.props.fallback || null
    return this.props.children
  }
}

function safeFormatTime(dateStr: string | Date | null | undefined): string {
  try {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return format(d, 'h:mm a')
  } catch (err) {
    return ''
  }
}

function MessageBubble({ message, isMine, showTime }: { message: any, isMine: boolean, showTime: boolean }) {
  const hasMedia = Array.isArray(message.media) && message.media.length > 0;
  
  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-full`}>
      <div 
        className={`max-w-[75%] px-4 py-2 rounded-2xl ${
          isMine 
            ? 'bg-primary text-primary-foreground rounded-br-sm' 
            : 'bg-surface-muted text-foreground rounded-bl-sm'
        } break-words`}
      >
        {message.isDeleted ? (
          <span className="italic opacity-70">This message was deleted</span>
        ) : (
          <>
            {hasMedia && (
              <div className="flex gap-2 flex-wrap mb-2">
                {message.media.map((m: any, i: number) => (
                  <img key={i} src={m?.url || ''} alt="Attached media" loading="lazy" decoding="async" className="max-w-full rounded-lg object-cover max-h-64" />
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap">{String(message.content || '')}</p>
          </>
        )}
      </div>
      {showTime && (
        <span className="text-[10px] text-foreground-muted mt-1 px-1">
          {safeFormatTime(message.createdAt)}
        </span>
      )}
    </div>
  )
}
// ----------------------------

export function ChatWindow({ conversationId }: { conversationId: string }) {
  const { profile } = useAuth()
  const currentUserId = profile?.userId
  const { isConnected, messagingSocket } = useSocket()
  const queryClient = useQueryClient()
  
  const [inputText, setInputText] = useState('')

  // Handle reconnect logic: refetch when connection is restored
  useEffect(() => {
    if (isConnected.messaging) {
      queryClient.invalidateQueries({ 
        queryKey: ['messages', conversationId],
        refetchPage: (page: any, index: number) => index === 0 
      })
      queryClient.invalidateQueries({ 
        queryKey: ['conversations'],
        refetchPage: (page: any, index: number) => index === 0
      })
    }
  }, [isConnected.messaging, conversationId, queryClient])
  
  // Get conversation details to show header
  const { data: conversationsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagingApi.getConversations(),
    staleTime: 60 * 1000,
  })
  
  const conversation = (conversationsData as any)?.pages 
    ? (conversationsData as any).pages.flatMap((p: any) => p.items || []).find((c: any) => c.id === conversationId)
    : conversationsData?.items?.find((c: any) => c.id === conversationId)
  const otherUser = conversation?.targetUser

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) => messagingApi.getMessages(conversationId, pageParam as { cursorAt?: string; cursorId?: string } | undefined),
    initialPageParam: undefined as { cursorAt?: string; cursorId?: string } | undefined,
    getNextPageParam: (lastPage) => 
      lastPage.nextCursorAt && lastPage.nextCursorId
        ? { cursorAt: lastPage.nextCursorAt, cursorId: lastPage.nextCursorId }
        : undefined,
  })

  const rawMessages = data?.pages.flatMap((page) => page.items || []) ?? []
  // Deduplicate messages and filter out undefined/null items to prevent UI crashes
  const messages = Array.from(new Map(rawMessages.filter(Boolean).map(m => [m.id, m])).values())

  const { isIntersecting: isTopIntersecting, ref: topRef } = useIntersectionObserver({
    threshold: 0.1,
  })

  useEffect(() => {
    if (isTopIntersecting && hasNextPage && !isFetchingNextPage && status !== 'pending') {
      fetchNextPage()
    }
  }, [isTopIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage, status])

  const markAsReadMutation = useMutation({
    mutationFn: (messageId: string) => messagingApi.markAsRead(conversationId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count', 'messages'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  // Real-time updates
  useEffect(() => {
    if (!messagingSocket) return

    const handleNewMessage = (payload: any) => {
      if (payload.conversationId !== conversationId) return

      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData

        // Deduplication check
        const alreadyExists = oldData.pages.some((page: any) => 
          (page.items || []).some((msg: any) => msg.id === payload.id)
        )
        if (alreadyExists) return oldData

        // Remove the temporary optimistic message that matches this payload
        let tempRemoved = false
        const cleanedPages = oldData.pages.map((page: any) => ({
          ...page,
          items: (page.items || []).filter((msg: any) => {
            if (msg.id.startsWith('temp-') && msg.content === payload.content && !tempRemoved) {
              tempRemoved = true
              return false
            }
            return true
          })
        }))

        // Add to the beginning of the first page (newest message)
        cleanedPages[0] = {
          ...cleanedPages[0],
          items: [payload, ...(cleanedPages[0].items || [])],
        }
        return { ...oldData, pages: cleanedPages }
      })

      // If it's from the other user, we should mark it as read immediately since we are viewing the chat
      if (payload.senderId !== currentUserId && document.hasFocus()) {
        markAsReadMutation.mutate(payload.id)
      }
    }

    const handleMessageDeleted = (payload: any) => {
      if (payload.conversationId !== conversationId) return
      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData
        const newPages = oldData.pages.map((page: any) => ({
          ...page,
          items: (page.items || []).filter((msg: any) => msg.id !== payload.messageId && msg.id !== payload.id)
        }))
        return { ...oldData, pages: newPages }
      })
    }

    const handleMessageUpdated = (payload: any) => {
      if (payload.conversationId !== conversationId) return
      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData
        const newPages = oldData.pages.map((page: any) => ({
          ...page,
          items: (page.items || []).map((msg: any) => 
            (msg.id === payload.id || msg.id === payload.messageId) 
              ? { ...msg, ...payload, isEdited: true } 
              : msg
          )
        }))
        return { ...oldData, pages: newPages }
      })
    }

    messagingSocket.on('message:new', handleNewMessage)
    messagingSocket.on('message:deleted', handleMessageDeleted)
    messagingSocket.on('message:updated', handleMessageUpdated)

    return () => {
      messagingSocket.off('message:new', handleNewMessage)
      messagingSocket.off('message:deleted', handleMessageDeleted)
      messagingSocket.off('message:updated', handleMessageUpdated)
    }
  }, [messagingSocket, conversationId, queryClient, currentUserId])

  // Mark latest received message as read on mount if unread
  useEffect(() => {
    if (messages.length > 0) {
      const latestFromOther = messages.find((m) => m.senderId !== currentUserId)
      if (latestFromOther) {
        // We just blindly mark read on load, relying on backend idempotency
        markAsReadMutation.mutate(latestFromOther.id)
      }
    }
  }, [messages.length, currentUserId, conversationId])

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => messagingApi.sendMessage(conversationId, { content, messageType: 'TEXT' }),
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] })
      
      const previousMessages = queryClient.getQueryData(['messages', conversationId])
      
      const optimisticMsg: MessageItem = {
        id: `temp-${crypto.randomUUID()}`,
        conversationId,
        senderId: currentUserId!,
        content,
        messageType: 'TEXT',
        media: null,
        replyToMessageId: null,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return { pages: [{ items: [optimisticMsg], hasMore: false }] }
        const newPages = [...oldData.pages]
        newPages[0] = {
          ...newPages[0],
          items: [optimisticMsg, ...(newPages[0].items || [])],
        }
        return { ...oldData, pages: newPages }
      })

      setInputText('')
      return { previousMessages }
    },
    onError: (_err, _variables, context) => {
      queryClient.setQueryData(['messages', conversationId], context?.previousMessages)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['messages', conversationId],
        refetchPage: (page: any, index: number) => index === 0 
      })
      queryClient.invalidateQueries({ 
        queryKey: ['conversations'],
        refetchPage: (page: any, index: number) => index === 0
      })
    }
  })

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return
    sendMessageMutation.mutate(inputText.trim())
  }

  return (
    <div className="flex flex-col h-full bg-surface w-full relative">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-surface/95 backdrop-blur z-10 shrink-0">
        <Link 
          to="/messages" 
          className="md:hidden p-2 -ml-2 rounded-full hover:bg-surface-muted text-foreground-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="relative shrink-0">
          {otherUser?.avatarUrl ? (
            <img src={otherUser.avatarUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="font-medium">{otherUser?.displayName?.[0] || '?'}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-foreground truncate">
            {otherUser?.displayName || 'Unknown User'}
          </span>
          {/* Typically we'd show online status here */}
        </div>
      </div>

      {/* Messages Area (flex-col-reverse) */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col-reverse p-4 gap-4 scroll-smooth">
        {status === 'pending' ? (
          <div className="flex justify-center p-8 w-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center justify-center h-full w-full">
            <p className="text-sm text-danger font-medium mb-2">Failed to load chat</p>
            <button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })}
              className="text-xs text-primary hover:underline"
            >
              Try Again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-foreground-muted">
            <p>Start a conversation with {otherUser?.displayName}</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isMine = message.senderId === currentUserId
              
              let showTime = index === messages.length - 1
              try {
                if (!showTime && messages[index + 1]?.createdAt && message?.createdAt) {
                  const nextTime = new Date(messages[index + 1].createdAt).getTime()
                  const currTime = new Date(message.createdAt).getTime()
                  if (!isNaN(nextTime) && !isNaN(currTime)) {
                     showTime = nextTime - currTime > 10 * 60 * 1000 // 10 min gap
                  }
                }
              } catch (err) {
                // Ignore date math errors
              }

              return (
                <ErrorBoundary 
                  key={message.id || index} 
                  fallback={<div className="text-xs text-danger my-2">Failed to render message</div>}
                >
                  <MessageBubble message={message} isMine={isMine} showTime={showTime} />
                </ErrorBoundary>
              )
            })}
            
            <div ref={topRef} className="h-10 w-full flex items-center justify-center">
              {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>
          </>
        )}
      </div>

      {/* Input Area \u2014 pb-safe for iOS home indicator */}
      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-border bg-surface shrink-0">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <button 
            type="button" 
            className="p-3 text-foreground-muted hover:text-foreground hover:bg-surface-muted rounded-full transition-colors shrink-0"
            title="Attach image"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            placeholder="Type a message..."
            className="flex-1 max-h-32 min-h-[44px] resize-none bg-surface-muted border-none rounded-2xl px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-primary/50 placeholder:text-foreground-muted scrollbar-hide"
            rows={1}
          />
          
          <button 
            type="submit" 
            disabled={!inputText.trim() || sendMessageMutation.isPending}
            className="p-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5 -ml-0.5 mt-0.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
