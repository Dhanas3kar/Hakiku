import { createFileRoute, Outlet, useMatchRoute } from '@tanstack/react-router'
import { ConversationList } from '../components/messaging/ConversationList'
import { ErrorBoundary } from '../components/common/ErrorBoundary'

export const Route = createFileRoute('/_authenticated/messages')({
  component: MessagesLayout,
})

function MessagesLayout() {
  const matchRoute = useMatchRoute()
  const isConversationSelected = matchRoute({ to: '/messages/$conversationId', fuzzy: true })

  return (
    /* Full height minus: mobile header (≈53px ≈ 3.375rem) and bottom nav (3.5rem) + safe area.
       On md+ there's no bottom nav, just subtract the header. */
    <div className="flex w-full overflow-hidden bg-background
      h-[calc(100dvh-3.375rem-3.5rem-env(safe-area-inset-bottom,0px))]
      md:h-[calc(100dvh-2rem)]
      md:rounded-xl md:border md:border-border shadow-sm">
      {/* Sidebar / Conversation List */}
      <div
        className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border bg-surface flex flex-col transition-all ${
          isConversationSelected ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ErrorBoundary>
          <ConversationList />
        </ErrorBoundary>
      </div>

      {/* Main Chat Area */}
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
