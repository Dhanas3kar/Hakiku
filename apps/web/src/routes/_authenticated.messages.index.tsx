import { createFileRoute } from '@tanstack/react-router'
import { MessageSquare } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/messages/')({
  component: MessagesIndex,
})

function MessagesIndex() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-background hidden md:flex">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted">
        <MessageSquare className="h-6 w-6 text-foreground-muted" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Your messages</h2>
      <p className="mt-2 max-w-sm text-sm text-foreground-muted leading-relaxed">
        Select a conversation to continue, or start a new one from a profile.
      </p>
    </div>
  )
}
