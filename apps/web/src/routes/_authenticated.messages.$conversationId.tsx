import { createFileRoute } from '@tanstack/react-router'
import { ChatWindow } from '../components/messaging/ChatWindow'

export const Route = createFileRoute('/_authenticated/messages/$conversationId')({
  component: ChatRoute,
})

function ChatRoute() {
  const { conversationId } = Route.useParams()

  return <ChatWindow key={conversationId} conversationId={conversationId} />
}
