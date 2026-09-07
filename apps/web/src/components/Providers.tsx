import React, { useState } from 'react'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { SocketProvider } from '../hooks/useSocket'
import { SplashScreen } from './SplashScreen'
import { useSplash } from '../hooks/useSplash'

/**
 * Inner application shell.
 *
 * This component intentionally lives inside QueryClientProvider so that
 * initialization hooks can safely use React Query when required.
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

/**
 * Global application providers.
 *
 * Responsibilities:
 * - React Query client lifecycle
 * - Global query defaults
 * - Socket provider
 * - Initial application splash
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * Keep cached data usable while allowing individual
             * high-frequency queries to opt into shorter stale times.
             *
             * Individual queries can override this when necessary:
             *
             * staleTime: 0        -> always considered stale
             * staleTime: 30_000   -> 30 seconds
             * staleTime: 5 * 60e3 -> 5 minutes
             */
            staleTime: 30 * 1000,

            /**
             * Remove unused queries after 10 minutes.
             * This gives navigation-heavy pages enough cache retention
             * without keeping everything indefinitely.
             */
            gcTime: 10 * 60 * 1000,

            /**
             * Avoid hammering the API for errors that are unlikely
             * to succeed by retrying.
             */
            retry: (failureCount, error: any) => {
              const status = error?.status ?? error?.response?.status

              if ([400, 401, 403, 404, 409, 422, 429].includes(status)) {
                return false
              }

              return failureCount < 1
            },

            /**
             * Refetch when returning to the application.
             * This keeps notifications, messages and feeds reasonably fresh.
             */
            refetchOnWindowFocus: true,

            /**
             * Recover automatically after the network comes back.
             */
            refetchOnReconnect: true,

            /**
             * Don't aggressively refetch while a tab is hidden.
             */
            refetchIntervalInBackground: false,

            /**
             * Queries remain enabled by default.
             * Authentication-dependent queries can override this with:
             *
             * enabled: !!user
             */
            enabled: true,
          },

          mutations: {
            /**
             * Mutations are generally not safe to blindly retry because
             * repeating a POST/PATCH/DELETE can create duplicate actions.
             */
            retry: 0,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        {children}
      </AppShell>
    </QueryClientProvider>
  )
}
