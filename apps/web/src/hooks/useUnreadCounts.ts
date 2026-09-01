import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { notificationsApi } from '../api/notifications'
import { messagingApi } from '../api/messaging'
import { useSocket } from './useSocket'
import { useAuth } from './useAuth'

export function useUnreadCounts() {
  const queryClient = useQueryClient()
  const { notificationSocket, messagingSocket, isConnected } = useSocket()
  const { user } = useAuth()
  const currentUserId = user?.id

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

  // Removed redundant isConnected invalidations that caused 429 request amplification.
  // Reconnect invalidations are already handled globally in useSocket.tsx.

  useEffect(() => {
    if (!notificationSocket) return

    const handleNewNotification = (payload: any) => {
      // Optimistically increment the notification count or invalidate
      queryClient.setQueryData(['unread-count', 'notifications'], (old: any) => {
        if (!old) return { unreadCount: 1 }
        return { unreadCount: old.unreadCount + 1 }
      })
      // Only invalidate specific caches based on the notification type to avoid hammering the API
      if (payload?.type) {
        if (['POST_LIKE', 'COMMENT', 'COMMENT_LIKE'].includes(payload.type)) {
          queryClient.invalidateQueries({ queryKey: ['feed'] })
          queryClient.invalidateQueries({ queryKey: ['discover'] })
          queryClient.invalidateQueries({ queryKey: ['user-posts'] })
        }
        if (['FOLLOW', 'CONNECTION_REQUEST', 'CONNECTION_ACCEPTED'].includes(payload.type)) {
          queryClient.invalidateQueries({ queryKey: ['connections'] })
        }
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    notificationSocket.on('notification:new', handleNewNotification)

    return () => {
      notificationSocket.off('notification:new', handleNewNotification)
    }
  }, [notificationSocket, queryClient])

  useEffect(() => {
    if (!messagingSocket) return

    const handleNewMessage = (payload: any) => {
      // Only increment if the message is from someone else
      if (payload && currentUserId && payload.senderId !== currentUserId) {
        queryClient.setQueryData(['unread-count', 'messages'], (old: any) => {
          if (!old) return { unreadCount: 1 }
          return { unreadCount: old.unreadCount + 1 }
        })
      }
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
