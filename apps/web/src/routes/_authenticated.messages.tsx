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
    <div className="flex w-full overflow-hidden bg-surface border-border-subtle
      h-[calc(100dvh-3.375rem-3.5rem-env(safe-area-inset-bottom,0px))]
      md:h-[100dvh] md:border-l">
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
