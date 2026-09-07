import { createFileRoute, Outlet, useMatchRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { ConversationList } from '../components/messaging/ConversationList'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { messagingApi } from '../api/messaging'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/messages')({
  validateSearch: (search: Record<string, unknown>): { targetUserId?: string } => {
    return {
      targetUserId: typeof search.targetUserId === 'string' ? search.targetUserId : undefined,
    }
  },
  component: MessagesLayout,
})

function MessagesLayout() {
  const matchRoute = useMatchRoute()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { targetUserId } = useSearch({ from: '/_authenticated/messages' })
  const isConversationSelected = matchRoute({ to: '/messages/$conversationId', fuzzy: true })
  const triggeredTargetRef = useRef<string | null>(null)

  const createConvMutation = useMutation({
    mutationFn: (userId: string) => messagingApi.createConversation(userId),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      navigate({
        to: '/messages/$conversationId',
        params: { conversationId: conversation.id },
        replace: true,
      })
      createConvMutation.reset()
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Could not start conversation')
      createConvMutation.reset()
    },
  })

  useEffect(() => {
    if (!targetUserId || triggeredTargetRef.current === targetUserId) return

    triggeredTargetRef.current = targetUserId

    // Check if conversation already exists in query cache for instant navigation
    const cachedConversations: any = queryClient.getQueryData(['conversations'])
    const existing = cachedConversations?.pages
      ?.flatMap((p: any) => p.items || [])
      ?.find((c: any) => 
        c.targetUser?.id === targetUserId || 
        c.otherUser?.id === targetUserId ||
        c.participants?.some((p: any) => (p.userId || p.user?.id) === targetUserId)
      )

    if (existing?.id) {
      navigate({
        to: '/messages/$conversationId',
        params: { conversationId: existing.id },
        replace: true,
      })
      return
    }

    createConvMutation.mutate(targetUserId)
  }, [targetUserId, queryClient, navigate])

  return (
    <div className="flex w-full overflow-hidden bg-surface border-border-subtle
      h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom,0px))]
      md:h-[100dvh] md:border-l relative">
      {createConvMutation.isPending && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center gap-3 text-foreground font-medium">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Opening chat...</span>
        </div>
      )}
      <div
        className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border-subtle bg-surface flex flex-col ${
          isConversationSelected ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ErrorBoundary>
          <ConversationList />
        </ErrorBoundary>
      </div>

      <div
        className={`flex-1 flex flex-col min-w-0 bg-background ${
          !isConversationSelected ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  )
}
