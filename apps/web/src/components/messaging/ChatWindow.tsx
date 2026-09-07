import React, { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messagingApi } from '../../api/messaging'
import type { MessageItem } from '../../api/messaging'
import { useSocket } from '../../hooks/useSocket'
import { useAuth } from '../../hooks/useAuth'
import { format } from 'date-fns'
import { Loader2, Send, Image as ImageIcon, ArrowLeft, MoreVertical, Trash2, Flag, AlertTriangle } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useIntersectionObserver } from 'usehooks-ts'
import { Avatar } from '../ui/Avatar'
import { ReportDialog } from '../community/ReportDialog'
import { toast } from 'sonner'

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

function MessageBubble({ 
  message, 
  isMine, 
  showTime,
  onDelete,
  onReport
}: { 
  message: any, 
  isMine: boolean, 
  showTime: boolean,
  onDelete?: (messageId: string) => void,
  onReport?: (messageId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const hasMedia = Array.isArray(message.media) && message.media.length > 0
  const isPending = typeof message.id === 'string' && message.id.startsWith('temp-')
  const isDeleted = Boolean(message.isDeleted || message.deletedAt)
  
  return (
    <div className={`group relative flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-full`}>
      <div className="relative flex items-center gap-1.5 max-w-full">
        {/* Context Menu Trigger for Sender / Receiver (Left side for mine, Right side for received) */}
        {!isPending && !isDeleted && isMine && (
          <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 text-foreground-subtle hover:text-foreground hover:bg-surface-muted rounded-full transition-colors cursor-pointer"
              title="Message options"
              aria-label="Message options"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-1 z-30 min-w-[120px] bg-surface-elevated border border-border rounded-xl shadow-lg py-1 text-xs">
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete?.(message.id)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-500/10 transition-colors text-left font-medium cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}

        <div 
          className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[15px] leading-relaxed ${
            isMine 
              ? 'bg-primary text-primary-foreground rounded-br-md' 
              : 'bg-surface-muted text-foreground rounded-bl-md'
          } break-words ${isPending ? 'opacity-70' : ''}`}
        >
          {isDeleted ? (
            <span className="italic opacity-70">This message was deleted</span>
          ) : (
            <>
              {hasMedia && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {message.media.map((m: any, i: number) => (
                    <img key={i} src={m?.url || ''} alt="Attached media" loading="lazy" decoding="async" className="max-w-full rounded-md object-cover max-h-64" />
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap">{String(message.content || '')}</p>
            </>
          )}
        </div>

        {/* Options for Received Messages */}
        {!isPending && !isDeleted && !isMine && (
          <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 text-foreground-subtle hover:text-foreground hover:bg-surface-muted rounded-full transition-colors cursor-pointer"
              title="Message options"
              aria-label="Message options"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute left-0 bottom-full mb-1 z-30 min-w-[130px] bg-surface-elevated border border-border rounded-xl shadow-lg py-1 text-xs">
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onReport?.(message.id)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-amber-500 hover:bg-amber-500/10 transition-colors text-left font-medium cursor-pointer"
                >
                  <Flag className="h-3.5 w-3.5" />
                  Report
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showTime && (
        <span className="text-[11px] text-foreground-subtle mt-1 px-1">
          {isPending ? 'Sending…' : safeFormatTime(message.createdAt)}
        </span>
      )}
    </div>
  )
}
// ----------------------------

import { safeRandomUUID } from '../../utils/uuid'

export function ChatWindow({ conversationId }: { conversationId: string }) {
  const { profile } = useAuth()
  const currentUserId = profile?.userId
  const { isConnected, messagingSocket } = useSocket()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [inputText, setInputText] = useState('')
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
  }

  // Get conversation details for header
  const { data: conversationData } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => messagingApi.getConversationDetails(conversationId),
    enabled: !!conversationId,
    staleTime: 60 * 1000,
  })

  // Safely fallback to cached infinite query data if present
  const cachedConversations: any = queryClient.getQueryData(['conversations'])
  const cachedConv = cachedConversations?.pages
    ? cachedConversations.pages.flatMap((p: any) => p.items || []).find((c: any) => c.id === conversationId)
    : undefined

  const otherUser = conversationData?.targetUser || cachedConv?.targetUser

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

  const rawMessages = (data?.pages ? [...data.pages].reverse() : [])
    .flatMap((page) => page.items || []) ?? []

  const messages = Array.from(new Map(rawMessages.filter(Boolean).map(m => [m.id, m])).values())

  const { isIntersecting: isTopIntersecting, ref: topRef } = useIntersectionObserver({
    threshold: 0.1,
  })

  useEffect(() => {
    if (isTopIntersecting && hasNextPage && !isFetchingNextPage && status !== 'pending') {
      fetchNextPage()
    }
  }, [isTopIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage, status])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('auto')
    }
  }, [conversationId])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth')
    }
  }, [messages.length])

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => messagingApi.deleteMessage(messageId),
    onSuccess: (_, messageId) => {
      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData
        const newPages = oldData.pages.map((page: any) => ({
          ...page,
          items: (page.items || []).map((msg: any) =>
            msg.id === messageId ? { ...msg, isDeleted: true, content: null } : msg
          )
        }))
        return { ...oldData, pages: newPages }
      })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  const clearChatMutation = useMutation({
    mutationFn: () => messagingApi.deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.removeQueries({ queryKey: ['messages', conversationId] })
      setClearConfirmOpen(false)
      navigate({ to: '/messages' })
    }
  })

  const markAsReadMutation = useMutation({
    mutationFn: (messageId?: string) => messagingApi.markAsRead(conversationId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count', 'messages'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  // Automatically mark conversation as read when viewed
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      const latestMsg = messages[messages.length - 1]
      markAsReadMutation.mutate(latestMsg?.id)
    }
  }, [conversationId, messages.length])

  // Real-time updates
  useEffect(() => {
    if (!messagingSocket) return

    const handleNewMessage = (payload: any) => {
      if (payload.conversationId !== conversationId) return

      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData
        const alreadyExists = oldData.pages.some((page: any) => 
          (page.items || []).some((msg: any) => msg.id === payload.id)
        )
        if (alreadyExists) return oldData

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

        cleanedPages[0] = {
          ...cleanedPages[0],
          items: [...(cleanedPages[0].items || []), payload],
        }
        return { ...oldData, pages: cleanedPages }
      })

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
          items: (page.items || []).map((msg: any) => 
            (msg.id === payload.messageId || msg.id === payload.id) 
              ? { ...msg, isDeleted: true, content: null } 
              : msg
          )
        }))
        return { ...oldData, pages: newPages }
      })
    }

    messagingSocket.on('message:new', handleNewMessage)
    messagingSocket.on('message:deleted', handleMessageDeleted)

    return () => {
      messagingSocket.off('message:new', handleNewMessage)
      messagingSocket.off('message:deleted', handleMessageDeleted)
    }
  }, [messagingSocket, conversationId, queryClient, currentUserId])

  const idempotencyKeyRef = useRef<string>(safeRandomUUID())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingMedia(true)
      const { mediaKey } = await messagingApi.uploadMedia(file)
      await messagingApi.sendMessage(conversationId, {
        messageType: 'IMAGE',
        mediaKeys: [mediaKey],
        idempotencyKey: safeRandomUUID(),
      })
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Image sent')
    } catch (err: any) {
      toast.error('Failed to upload image')
    } finally {
      setIsUploadingMedia(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const sendMessageMutation = useMutation({
    mutationFn: (payload: { content: string; idempotencyKey: string }) => 
      messagingApi.sendMessage(conversationId, { 
        content: payload.content, 
        messageType: 'TEXT',
        idempotencyKey: payload.idempotencyKey
      }),
    onMutate: async (payload) => {
      const content = payload.content;
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] })
      
      const previousMessages = queryClient.getQueryData(['messages', conversationId])
      
      const optimisticMsg: MessageItem = {
        id: `temp-${safeRandomUUID()}`,
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
          items: [...(newPages[0].items || []), optimisticMsg],
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
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return
    
    const currentKey = idempotencyKeyRef.current
    idempotencyKeyRef.current = safeRandomUUID()
    
    sendMessageMutation.mutate({ 
      content: inputText.trim(), 
      idempotencyKey: currentKey 
    })
  }

  return (
    <div className="flex flex-col h-full bg-background w-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link 
            to="/messages" 
            className="md:hidden p-2 -ml-2 rounded-md hover:bg-surface-muted text-foreground-muted min-h-11 min-w-11 inline-flex items-center justify-center"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Avatar src={otherUser?.avatarUrl} name={otherUser?.displayName || 'User'} />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground truncate">
              {otherUser?.displayName || 'Unknown User'}
            </span>
            <span className="text-[11px] text-foreground-subtle">
              {isConnected.messaging ? 'Connected' : 'Reconnecting…'}
            </span>
          </div>
        </div>

        {/* Chat Options Dropdown */}
        <div className="relative">
          <button
            onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
            className="p-2 rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
            aria-label="Chat options"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {headerMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 min-w-[140px] bg-surface-elevated border border-border rounded-2xl shadow-xl py-1 text-sm">
              <button
                onClick={() => {
                  setHeaderMenuOpen(false)
                  setClearConfirmOpen(true)
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-red-500 hover:bg-red-500/10 transition-colors text-left font-medium cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                Clear Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col p-4 gap-4 scroll-smooth">
        <div ref={topRef} className="h-6 w-full flex items-center justify-center shrink-0">
          {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        </div>

        {status === 'pending' ? (
          <div className="flex justify-center p-8 w-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center justify-center h-full w-full px-6 text-center">
            <p className="text-sm font-medium text-foreground mb-1">Couldn’t load this conversation</p>
            <p className="text-xs text-foreground-muted mb-3">Please try again.</p>
            <button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })}
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              Try Again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-foreground-muted px-6 text-center">
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1 text-foreground-subtle">Say hello to {otherUser?.displayName || 'them'}.</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isMine = message.senderId === currentUserId
            
            let showTime = index === messages.length - 1
            try {
              if (!showTime && messages[index + 1]?.createdAt && message?.createdAt) {
                const nextTime = new Date(messages[index + 1].createdAt).getTime()
                const currTime = new Date(message.createdAt).getTime()
                if (!isNaN(nextTime) && !isNaN(currTime)) {
                   showTime = nextTime - currTime > 10 * 60 * 1000
                }
              }
            } catch (err) {}

            return (
              <ErrorBoundary 
                key={message.id || index} 
                fallback={<div className="text-xs text-danger my-2">Failed to render message</div>}
              >
                <MessageBubble 
                  message={message} 
                  isMine={isMine} 
                  showTime={showTime}
                  onDelete={(id) => deleteMessageMutation.mutate(id)}
                  onReport={(id) => setReportingMessageId(id)}
                />
              </ErrorBoundary>
            )
          })
        )}

        <div ref={messagesEndRef} className="h-1 shrink-0" />
      </div>

      {/* Input Area */}
      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-border-subtle bg-surface shrink-0">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingMedia}
            className="p-3 text-foreground-muted hover:text-foreground hover:bg-surface-muted rounded-md transition-colors shrink-0 min-h-11 min-w-11 cursor-pointer disabled:opacity-50"
            title="Attach image"
            aria-label="Attach image"
          >
            {isUploadingMedia ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <ImageIcon className="h-5 w-5" />
            )}
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
            className="flex-1 max-h-32 min-h-[44px] resize-none bg-surface-muted border border-transparent rounded-md px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-0 placeholder:text-foreground-subtle scrollbar-hide"
            rows={1}
          />
          
          <button 
            type="submit" 
            disabled={!inputText.trim() || sendMessageMutation.isPending}
            className="p-3 bg-primary text-primary-foreground rounded-md hover:bg-primary-hover transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed min-h-11 min-w-11 inline-flex items-center justify-center cursor-pointer"
            aria-label="Send message"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5 -ml-0.5 mt-0.5" />
            )}
          </button>
        </form>
      </div>

      {/* Report Dialog Modal */}
      {reportingMessageId && (
        <ReportDialog
          isOpen={!!reportingMessageId}
          onClose={() => setReportingMessageId(null)}
          targetId={reportingMessageId}
          targetType="MESSAGE"
        />
      )}

      {/* Clear Chat Confirmation Modal */}
      {clearConfirmOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setClearConfirmOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl p-5 border border-border space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Clear Chat?</h3>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    This will clear all messages in this conversation for you.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setClearConfirmOpen(false)}
                  disabled={clearChatMutation.isPending}
                  className="px-3.5 py-2 text-xs font-semibold text-foreground-muted hover:bg-surface-muted rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => clearChatMutation.mutate()}
                  disabled={clearChatMutation.isPending}
                  className="flex items-center justify-center min-w-[80px] px-3.5 py-2 bg-red-500 text-white text-xs font-semibold rounded-xl hover:bg-red-600 transition-colors cursor-pointer"
                >
                  {clearChatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Clear Chat'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

