import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useState } from 'react'
import { SocketProvider } from '../hooks/useSocket'
import { SplashScreen } from './SplashScreen'
import { useSplash } from '../hooks/useSplash'

/**
 * Inner wrapper that can use React Query hooks (needs to be inside QueryClientProvider)
 */
function AppShell({ children }: { children: React.ReactNode }) {
  const { showSplash, splashReady } = useSplash()

  return (
    <>
      {showSplash && <SplashScreen ready={splashReady} />}
      <SocketProvider>
        {children}
      </SocketProvider>
    </>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000, // Data becomes stale after 5 seconds for responsive navigation
            gcTime: 5 * 60 * 1000,
            retry: (failureCount, error: any) => {
              if ([401, 403, 404, 429].includes(error?.status)) return false
              return failureCount < 1
            },
            refetchOnWindowFocus: true, // Auto-fetch newest posts, notifications & updates when switching back to tab
            refetchOnReconnect: true, // Auto-fetch on reconnect
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        {children}
      </AppShell>
    </QueryClientProvider>
  )
}
