import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
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
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: (failureCount, error: any) => {
              if ([401, 403, 404, 429].includes(error?.status)) return false
              return failureCount < 1
            },
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        {children}
      </AppShell>
      {import.meta.env.DEV && (
        <div className="hidden md:block">
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />
        </div>
      )}
    </QueryClientProvider>
  )
}
