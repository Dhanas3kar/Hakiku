import { createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { notificationsApi } from '../api/notifications'
import type { NotificationItem } from '../api/notifications'
import { useIntersectionObserver } from 'usehooks-ts'
import { useEffect, useRef, Fragment } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Bell, Heart, MessageCircle, UserPlus, CheckCircle2, MoreVertical, Trash, Info } from 'lucide-react'
import { Menu, Transition } from '@headlessui/react'

export const Route = createFileRoute('/_authenticated/notifications')({
  component: NotificationsPage,
})

function getNotificationIcon(type: string) {
  switch (type) {
    case 'POST_LIKE':
      return <Heart className="h-5 w-5 text-red-500 fill-current" />
    case 'POST_COMMENT':
    case 'COMMENT_REPLY':
      return <MessageCircle className="h-5 w-5 text-blue-500 fill-current" />
    case 'CONNECTION_REQUEST':
      return <UserPlus className="h-5 w-5 text-amber-500" />
    case 'CONNECTION_ACCEPTED':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    case 'FOLLOW':
      return <UserPlus className="h-5 w-5 text-purple-500" />
    case 'MESSAGE':
      return <MessageCircle className="h-5 w-5 text-emerald-500" />
    default:
      return <Info className="h-5 w-5 text-foreground-muted" />
  }
}

import { useSocket } from '../hooks/useSocket'

function NotificationsPage() {
  const queryClient = useQueryClient()
  const { isConnected, notificationSocket } = useSocket()
  
  // Handle reconnect logic
  useEffect(() => {
    if (isConnected.notifications) {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  }, [isConnected.notifications, queryClient])

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) => notificationsApi.getNotifications({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-count', 'notifications'] })
    },
  })

  const { isIntersecting, ref: bottomRef } = useIntersectionObserver({
    threshold: 0.1,
  })

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Real-time updates
  useEffect(() => {
    if (!notificationSocket) return

    const handleNewNotification = (payload: any) => {
      queryClient.setQueryData(['notifications'], (oldData: any) => {
        if (!oldData) return oldData

        // Deduplication check
        const alreadyExists = oldData.pages.some((page: any) => 
          (page.items || []).some((notif: any) => notif.id === payload.id)
        )
        if (alreadyExists) return oldData

        // Add to the beginning of the first page
        const newPages = [...oldData.pages]
        newPages[0] = {
          ...newPages[0],
          items: [payload, ...(newPages[0].items || [])],
        }
        return { ...oldData, pages: newPages }
      })
    }

    notificationSocket.on('notification:new', handleNewNotification)

    return () => {
      notificationSocket.off('notification:new', handleNewNotification)
    }
  }, [notificationSocket, queryClient])

  const notifications = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="w-full bg-surface sm:border sm:border-border sm:rounded-xl sm:shadow-sm min-h-screen sm:min-h-0">
      <div className="px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notifications
          </h1>
          <button
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending || notifications.length === 0}
            className="text-sm text-primary hover:text-primary/80 disabled:opacity-50 font-medium transition-colors"
          >
            Mark all as read
          </button>
        </div>

        {status === 'pending' ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : status === 'error' ? (
          <div className="text-center py-12 text-danger">
            Failed to load notifications. Please try again.
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-24 px-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted mb-4">
              <Bell className="h-8 w-8 text-foreground-muted" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">No notifications</h3>
            <p className="text-foreground-muted">When you get notifications, they'll show up here.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification) => (
              <NotificationItemRow key={notification.id} notification={notification} />
            ))}
            
            <div ref={bottomRef} className="py-4 flex justify-center">
              {isFetchingNextPage && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NotificationItemRow({ notification }: { notification: NotificationItem }) {
  const queryClient = useQueryClient()
  
  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      // Optimistic update would be better, but invalidation works
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-count', 'notifications'] })
    },
  })

  const navigate = useNavigate()

  const handleNavigation = () => {
    // 1. Mark as read
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id)
    }

    // 2. Navigate based on type
    switch (notification.type) {
      case 'CONNECTION_REQUEST':
      case 'CONNECTION_ACCEPTED':
      case 'FOLLOW':
        if (notification.actor?.username) {
          navigate({ to: '/profile/$username', params: { username: notification.actor.username } })
        }
        break;
      case 'MESSAGE':
        if (notification.payload?.conversationId) {
          navigate({ to: '/messages/$conversationId', params: { conversationId: notification.payload.conversationId } })
        } else if (notification.entityId) {
          navigate({ to: '/messages/$conversationId', params: { conversationId: notification.entityId } })
        }
        break;
      case 'POST_LIKE':
      case 'POST_COMMENT':
      case 'COMMENT_REPLY':
        const postId = notification.payload?.postId || notification.entityId;
        if (postId) {
          navigate({ to: '/', search: { postId } as any })
        } else {
          navigate({ to: '/' })
        }
        break;
      case 'SYSTEM':
      default:
        // Fallback to home/discover
        navigate({ to: '/' })
        break;
    }
  }

  const deleteMutation = useMutation({
    mutationFn: notificationsApi.deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      if (!notification.isRead) {
         queryClient.invalidateQueries({ queryKey: ['unread-count', 'notifications'] })
      }
    },
  })

  // Set up intersection observer to mark as read when visible
  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0.5, // require 50% visibility
  })

  const hasMarkedReadRef = useRef(false)

  useEffect(() => {
    if (isIntersecting && !notification.isRead && !hasMarkedReadRef.current) {
      hasMarkedReadRef.current = true
      // Short delay so we don't spam requests when quickly scrolling
      const timer = setTimeout(() => {
        markAsReadMutation.mutate(notification.id)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isIntersecting, notification.isRead, notification.id])

  return (
    <div
      ref={ref}
      onClick={handleNavigation}
      className={`group relative flex items-start gap-4 rounded-lg p-4 transition-colors cursor-pointer hover:bg-surface-muted ${
        !notification.isRead ? 'bg-primary/5' : ''
      }`}
    >
      <div className="relative mt-1 flex shrink-0 h-10 w-10">
        {notification.actor?.avatarUrl ? (
          <img src={notification.actor.avatarUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <span className="text-sm font-medium text-foreground-muted">
              {notification.actor?.displayName?.[0] || '?'}
            </span>
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface ring-2 ring-surface">
          {getNotificationIcon(notification.type)}
        </div>
      </div>

      <div className="flex-1 min-w-0 pr-8 sm:pr-10">
        <p className="text-sm text-foreground break-words">
          <span className="font-semibold">{notification.actor?.displayName || 'Someone'}</span>{' '}
          {(notification.content || '').replace(notification.actor?.displayName || '', '').trim()}
        </p>
        <p className="mt-1 text-xs text-foreground-muted">
          {notification.createdAt && !isNaN(new Date(notification.createdAt).getTime()) 
            ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }) 
            : 'Just now'}
        </p>
      </div>

      {!notification.isRead && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
      )}

      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="flex items-center justify-center rounded-full p-1.5 text-foreground-muted hover:bg-surface hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface">
            <span className="sr-only">Open options</span>
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-surface shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border">
              <div className="py-1">
                {!notification.isRead && (
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => markAsReadMutation.mutate(notification.id)}
                        className={`${
                          active ? 'bg-surface-muted text-foreground' : 'text-foreground-muted'
                        } flex w-full items-center px-4 py-2 text-sm`}
                      >
                        <CheckCircle2 className="mr-3 h-4 w-4" aria-hidden="true" />
                        Mark as read
                      </button>
                    )}
                  </Menu.Item>
                )}
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => deleteMutation.mutate(notification.id)}
                      className={`${
                        active ? 'bg-danger/10 text-danger' : 'text-danger'
                      } flex w-full items-center px-4 py-2 text-sm`}
                    >
                      <Trash className="mr-3 h-4 w-4" aria-hidden="true" />
                      Delete notification
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </div>
  )
}
