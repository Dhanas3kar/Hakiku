import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '../api/notifications'
import { messagingApi } from '../api/messaging'
import { useAuth } from './useAuth'

export function useUnreadCounts() {
  const { isAuthenticated } = useAuth()

  const { data: notificationsData } = useQuery({
    queryKey: ['unread-count', 'notifications'],
    queryFn: () => notificationsApi.getUnreadCount(),
    enabled: isAuthenticated,
    staleTime: 5 * 1000,
  })

  const { data: messagesData } = useQuery({
    queryKey: ['unread-count', 'messages'],
    queryFn: () => messagingApi.getUnreadCount(),
    enabled: isAuthenticated,
    staleTime: 5 * 1000,
  })

  return {
    notifications: notificationsData?.unreadCount || 0,
    messages: messagesData?.unreadCount || 0,
  }
}
