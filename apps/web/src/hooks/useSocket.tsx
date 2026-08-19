import { createContext, useContext, useEffect, useState } from 'react'
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
  
  const [notificationSocket, setNotificationSocket] = useState<Socket | null>(null)
  const [messagingSocket, setMessagingSocket] = useState<Socket | null>(null)
  
  const [isConnected, setIsConnected] = useState({
    notifications: false,
    messaging: false,
  })

  useEffect(() => {
    // Only connect if the user is fully authenticated
    if (!isAuthenticated) {
      if (notificationSocket) {
        notificationSocket.disconnect()
        setNotificationSocket(null)
      }
      if (messagingSocket) {
        messagingSocket.disconnect()
        setMessagingSocket(null)
      }
      setIsConnected({ notifications: false, messaging: false })
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    // Configure base options: send cookies automatically with bounded backoff
    const socketOptions = {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    }

    // Connect to Notifications namespace (default `/`)
    const notifSocket = io(apiUrl, socketOptions)
    
    // Connect to Messaging namespace (`/messages`)
    const msgSocket = io(`${apiUrl}/messages`, socketOptions)

    notifSocket.on('connect', () => {
      setIsConnected(prev => ({ ...prev, notifications: true }))
    })
    
    notifSocket.io.on('reconnect', () => {
      // Trigger REST resynchronization
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unreadCounts'] })
    })

    notifSocket.on('disconnect', () => {
      setIsConnected(prev => ({ ...prev, notifications: false }))
    })

    msgSocket.on('connect', () => {
      setIsConnected(prev => ({ ...prev, messaging: true }))
    })
    
    msgSocket.io.on('reconnect', () => {
      // Trigger REST resynchronization
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      queryClient.invalidateQueries({ queryKey: ['unreadCounts'] })
    })

    msgSocket.on('disconnect', () => {
      setIsConnected(prev => ({ ...prev, messaging: false }))
    })

    setNotificationSocket(notifSocket)
    setMessagingSocket(msgSocket)

    return () => {
      notifSocket.disconnect()
      msgSocket.disconnect()
    }
  }, [isAuthenticated])

  const isDisconnected = isAuthenticated && (!isConnected.notifications || !isConnected.messaging)

  return (
    <SocketContext.Provider value={{ notificationSocket, messagingSocket, isConnected }}>
      {children}
      {isDisconnected && (
        <div className="fixed bottom-16 md:bottom-4 left-4 z-[100] flex items-center gap-2 rounded-full bg-surface/90 backdrop-blur-sm border border-border px-3 py-1.5 shadow-sm text-xs font-medium text-foreground-muted animate-in fade-in slide-in-from-bottom-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-warning"></span>
          </span>
          Reconnecting...
        </div>
      )}
    </SocketContext.Provider>
  )
}
