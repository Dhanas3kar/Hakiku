import { createFileRoute, Outlet, useMatchRoute } from '@tanstack/react-router'
import { ConversationList } from '../components/messaging/ConversationList'

export const Route = createFileRoute('/_authenticated/messages')({
  component: MessagesLayout,
})

function MessagesLayout() {
  const matchRoute = useMatchRoute()
  const isConversationSelected = matchRoute({ to: '/messages/$conversationId', fuzzy: true })

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] w-full overflow-hidden bg-background md:rounded-xl md:border md:border-border shadow-sm">
      {/* Sidebar / Conversation List */}
      <div 
        className={`w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border bg-surface flex flex-col transition-all ${
          isConversationSelected ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ConversationList />
      </div>

      {/* Main Chat Area */}
      <div 
        className={`flex-1 flex flex-col min-w-0 bg-background ${
          !isConversationSelected ? 'hidden md:flex' : 'flex'
        }`}
      >
        <Outlet />
      </div>
    </div>
  )
}
