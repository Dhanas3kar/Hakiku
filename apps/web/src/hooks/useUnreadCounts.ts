import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { notificationsApi } from '../api/notifications'
import { messagingApi } from '../api/messaging'
import { useSocket } from './useSocket'

export function useUnreadCounts() {
  const queryClient = useQueryClient()
  const { notificationSocket, messagingSocket, isConnected } = useSocket()

  const { data: notificationsData } = useQuery({
    queryKey: ['unread-count', 'notifications'],
    queryFn: () => notificationsApi.getUnreadCount(),
    staleTime: Infinity, // Relies on WebSocket for updates
  })

  const { data: messagesData } = useQuery({
    queryKey: ['unread-count', 'messages'],
    queryFn: () => messagingApi.getUnreadCount(),
    staleTime: Infinity, // Relies on WebSocket for updates
  })

  // Handle reconnects
  useEffect(() => {
    if (isConnected.notifications) {
      queryClient.invalidateQueries({ queryKey: ['unread-count', 'notifications'] })
    }
  }, [isConnected.notifications, queryClient])

  useEffect(() => {
    if (isConnected.messaging) {
      queryClient.invalidateQueries({ queryKey: ['unread-count', 'messages'] })
    }
  }, [isConnected.messaging, queryClient])

  useEffect(() => {
    if (!notificationSocket) return

    const handleNewNotification = () => {
      // Optimistically increment the notification count or invalidate
      queryClient.setQueryData(['unread-count', 'notifications'], (old: any) => {
        if (!old) return { unreadCount: 1 }
        return { unreadCount: old.unreadCount + 1 }
      })
      // Also invalidate the main list
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    notificationSocket.on('notification:new', handleNewNotification)

    return () => {
      notificationSocket.off('notification:new', handleNewNotification)
    }
  }, [notificationSocket, queryClient])

  useEffect(() => {
    if (!messagingSocket) return

    const handleNewMessage = () => {
      // Invalidate message count to get accurate sum, or optimistic increment
      // For cross-conversation safety, invalidation is easier, but optimistic is faster.
      queryClient.invalidateQueries({ queryKey: ['unread-count', 'messages'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }

    messagingSocket.on('message:new', handleNewMessage)

    return () => {
      messagingSocket.off('message:new', handleNewMessage)
    }
  }, [messagingSocket, queryClient])

  return {
    notifications: notificationsData?.unreadCount || 0,
    messages: messagesData?.unreadCount || 0,
  }
}
