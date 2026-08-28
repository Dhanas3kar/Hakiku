import { useEffect, useRef, useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { AUTH_QUERY_KEY } from './useAuth'

const SESSION_KEY = 'hakiku_splash_shown'

/**
 * useSplash — determines whether the splash screen should be shown.
 *
 * Rules:
 * 1. Only show on the very first load of the session (sessionStorage guards repeat shows).
 * 2. "Ready" when the auth query has been observed in-flight AND then settled
 *    (or if no auth query ever starts within 300ms — e.g. on public/login routes).
 * 3. The SplashScreen component handles minimum display time and safety timeout.
 */
export function useSplash() {
  // Check sessionStorage synchronously — never show splash on SPA navigations
  const [shouldShow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    if (sessionStorage.getItem(SESSION_KEY)) return false
    return true
  })

  const [ready, setReady] = useState(!shouldShow)

  // Track whether the auth query was ever seen in-flight
  const authWasInFlightRef = useRef(false)
  const queryClient = useQueryClient()

  // How many auth queries are currently fetching
  const isFetchingAuth = useIsFetching({ queryKey: AUTH_QUERY_KEY })

  useEffect(() => {
    if (!shouldShow || ready) return

    if (isFetchingAuth > 0) {
      authWasInFlightRef.current = true
    }

    if (authWasInFlightRef.current && isFetchingAuth === 0) {
      // Auth query has started and settled
      markReady()
    }
  }, [isFetchingAuth, shouldShow, ready])

  useEffect(() => {
    if (!shouldShow || ready) return

    // Fallback: if auth query never started within 400ms (e.g. public route with no auth query)
    // check via queryClient if the auth state is already cached
    const t = setTimeout(() => {
      if (!authWasInFlightRef.current) {
        // Check if auth is already settled in cache (won't be fetching)
        const queryState = queryClient.getQueryState(AUTH_QUERY_KEY)
        if (queryState && queryState.status !== 'pending') {
          markReady()
        } else if (!queryState) {
          // No auth query at all on this route — just show app (e.g. login page)
          markReady()
        }
      }
    }, 400)

    return () => clearTimeout(t)
  }, [shouldShow, ready, queryClient])

  function markReady() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setReady(true)
  }

  return {
    showSplash: shouldShow,
    splashReady: ready,
  }
}

