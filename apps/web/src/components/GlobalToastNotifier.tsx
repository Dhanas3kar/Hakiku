import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'

export function GlobalToastNotifier() {
  const queryClient = useQueryClient()
  const { notificationSocket, messagingSocket } = useSocket()
  const { user } = useAuth()
  const currentUserId = user?.id

  // Non-message notification toasts
  useEffect(() => {
    if (!notificationSocket) return

    const handleNewNotification = (payload: any) => {
      // Prevent self-notifications
      if (currentUserId && (payload?.actorId === currentUserId || payload?.actor?.id === currentUserId || payload?.recipientId === payload?.actorId)) {
        return
      }

      queryClient.setQueryData(['unread-count', 'notifications'], (old: any) => {
        if (!old) return { unreadCount: 1 }
        return { unreadCount: (old.unreadCount || 0) + 1 }
      })

      if (payload?.type) {
        if (['POST_LIKE', 'COMMENT', 'COMMENT_LIKE', 'POST_COMMENT'].includes(payload.type)) {
          queryClient.invalidateQueries({ queryKey: ['feed'] })
          queryClient.invalidateQueries({ queryKey: ['discover'] })
          queryClient.invalidateQueries({ queryKey: ['user-posts'] })
        }
        if (['FOLLOW', 'CONNECTION_REQUEST', 'CONNECTION_ACCEPTED'].includes(payload.type)) {
          queryClient.invalidateQueries({ queryKey: ['connections'] })
        }
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] })

      const actorName = payload.actor?.displayName || payload.actorName || 'Someone'
      let message = payload.content || 'Interacted with your content'

      if (payload.type === 'POST_LIKE') message = 'liked your post'
      else if (payload.type === 'COMMENT' || payload.type === 'POST_COMMENT') message = 'commented on your post'
      else if (payload.type === 'COMMENT_LIKE') message = 'liked your comment'
      else if (payload.type === 'FOLLOW') message = 'started following you'
      else if (payload.type === 'CONNECTION_REQUEST') message = 'sent you a connection request'
      else if (payload.type === 'CONNECTION_ACCEPTED') message = 'accepted your connection request'

      toast(actorName, {
        id: `notif-${payload.id || Date.now()}`,
        description: message,
        position: 'top-center',
        duration: 3500,
        action: {
          label: 'View',
          onClick: () => {
            if (['CONNECTION_REQUEST', 'CONNECTION_ACCEPTED', 'FOLLOW'].includes(payload.type)) {
              if (payload.actor?.username) {
                window.location.href = `/profile/${payload.actor.username}`
              } else {
                window.location.href = `/network`
              }
            } else if (['POST_LIKE', 'COMMENT', 'POST_COMMENT', 'COMMENT_LIKE'].includes(payload.type)) {
              const postId = payload.payload?.postId || payload.entityId
              if (postId) {
                window.location.href = `/?postId=${postId}`
              } else {
                window.location.href = `/`
              }
            }
          },
        },
      })
    }

    notificationSocket.on('notification:new', handleNewNotification)
    return () => {
      notificationSocket.off('notification:new', handleNewNotification)
    }
  }, [notificationSocket, queryClient])

  // Real-time message toasts (deduplicated by single listener + toast id)
  useEffect(() => {
    if (!messagingSocket) return

    const handleNewMessage = (payload: any) => {
      if (payload && currentUserId && payload.senderId !== currentUserId) {
        queryClient.setQueryData(['unread-count', 'messages'], (old: any) => {
          if (!old) return { unreadCount: 1 }
          return { unreadCount: (old.unreadCount || 0) + 1 }
        })

        const isViewingConversation = window.location.pathname === `/messages/${payload.conversationId}`
        if (!isViewingConversation) {
          const senderName = payload.sender?.displayName || payload.senderName || 'Message'
          const toastId = `msg-${payload.id || payload.conversationId}`

          toast(senderName, {
            id: toastId,
            description: payload.content || 'Sent an attachment',
            position: 'top-center',
            duration: 3500,
            action: {
              label: 'Reply',
              onClick: () => {
                window.location.href = `/messages/${payload.conversationId}`
              },
            },
          })
        }
      }
    }

    messagingSocket.on('message:new', handleNewMessage)
    return () => {
      messagingSocket.off('message:new', handleNewMessage)
    }
  }, [messagingSocket, queryClient, currentUserId])

  return null
}
