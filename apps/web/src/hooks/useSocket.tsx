import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

interface SocketContextValue {
  notificationSocket: Socket | null
  messagingSocket: Socket | null
  isConnected: {
    notifications: boolean
    messaging: boolean
  }
}

const SocketContext = createContext<SocketContextValue | null>(null)

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const invalidateTimeoutRef = useRef<number | null>(null)
  const socketsRef = useRef<{ notification: Socket | null; messaging: Socket | null }>({
    notification: null,
    messaging: null,
  })

  const [notificationSocket, setNotificationSocket] = useState<Socket | null>(null)
  const [messagingSocket, setMessagingSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState({
    notifications: false,
    messaging: false,
  })

  useEffect(() => {
    const invalidateQueriesSafely = (keys: Array<readonly unknown[]>) => {
      if (invalidateTimeoutRef.current) {
        window.clearTimeout(invalidateTimeoutRef.current)
      }

      invalidateTimeoutRef.current = window.setTimeout(() => {
        keys.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey })
        })
      }, 150)
    }

    const disconnectSockets = () => {
      if (socketsRef.current.notification) {
        socketsRef.current.notification.disconnect()
        socketsRef.current.notification = null
      }
      if (socketsRef.current.messaging) {
        socketsRef.current.messaging.disconnect()
        socketsRef.current.messaging = null
      }
      setNotificationSocket(null)
      setMessagingSocket(null)
      setIsConnected({ notifications: false, messaging: false })
    }

    if (!isAuthenticated) {
      disconnectSockets()
      return
    }

    if (socketsRef.current.notification && socketsRef.current.messaging) {
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const socketOptions = {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.5,
    }

    const notifSocket = io(apiUrl, socketOptions)
    const msgSocket = io(`${apiUrl}/messages`, socketOptions)

    socketsRef.current.notification = notifSocket
    socketsRef.current.messaging = msgSocket
    setNotificationSocket(notifSocket)
    setMessagingSocket(msgSocket)

    notifSocket.on('connect', () => {
      setIsConnected(prev => ({ ...prev, notifications: true }))
    })

    notifSocket.io.on('reconnect', () => {
      invalidateQueriesSafely([['notifications'], ['unreadCounts']])
    })

    notifSocket.on('disconnect', () => {
      setIsConnected(prev => ({ ...prev, notifications: false }))
    })

    msgSocket.on('connect', () => {
      setIsConnected(prev => ({ ...prev, messaging: true }))
    })

    msgSocket.io.on('reconnect', () => {
      invalidateQueriesSafely([['conversations'], ['messages'], ['unreadCounts']])
    })

    msgSocket.on('disconnect', () => {
      setIsConnected(prev => ({ ...prev, messaging: false }))
    })

    return () => {
      disconnectSockets()
      if (invalidateTimeoutRef.current) {
        window.clearTimeout(invalidateTimeoutRef.current)
      }
    }
  }, [isAuthenticated, queryClient])

  return (
    <SocketContext.Provider value={{ notificationSocket, messagingSocket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}
