import { createFileRoute } from '@tanstack/react-router'
import { MessageSquare } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/messages/')({
  component: MessagesIndex,
})

function MessagesIndex() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-surface hidden md:flex">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-surface-muted">
        <MessageSquare className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Your Messages</h2>
      <p className="mt-2 max-w-sm text-sm text-foreground-muted">
        Select a conversation from the sidebar to start chatting, or start a new conversation.
      </p>
    </div>
  )
}
