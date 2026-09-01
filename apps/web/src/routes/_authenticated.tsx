import { createFileRoute, Outlet, useLocation, useRouter } from '@tanstack/react-router'
import { ShellLayout } from '../layouts/ShellLayout'
import { useAuth, AUTH_QUERY_KEY } from '../hooks/useAuth'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const auth = useAuth()
  const { isAuthenticated, needsOnboarding, status } = auth
  const location = useLocation()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    const handleAuthExpired = () => {
      // Instead of clearing the cache (which causes /login to refetch and hit 401 again),
      // we explicitly set the auth query to null so it stays cached as unauthenticated.
      queryClient.setQueryData(AUTH_QUERY_KEY, null)
      // We can also clear other queries
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth'
      })

      if (location.pathname !== '/login') {
        router.navigate({ to: '/login', replace: true })
      }
    }

    window.addEventListener('auth:expired', handleAuthExpired)
    return () => window.removeEventListener('auth:expired', handleAuthExpired)
  }, [location.pathname, queryClient, router])

  useEffect(() => {
    if (status === 'unauthenticated') {
      if (location.pathname !== '/login') {
        router.navigate({ to: '/login', search: { redirect: location.pathname }, replace: true })
      }
      return
    }

    if (needsOnboarding && !location.pathname.startsWith('/onboarding')) {
      router.navigate({ to: '/onboarding', replace: true })
      return
    }

    if (!needsOnboarding && location.pathname.startsWith('/onboarding') && status === 'authenticated') {
      router.navigate({ to: '/', replace: true })
    }
  }, [status, isAuthenticated, needsOnboarding, location.pathname, router])

  if (status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center bg-background text-foreground gap-4">
        <p className="text-danger font-medium">{auth.error?.message || 'Failed to connect to the server'}</p>
        <button
          onClick={() => auth.refetchSession()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (status === 'unauthenticated' || !isAuthenticated) {
    return null
  }

  if (needsOnboarding && !location.pathname.startsWith('/onboarding')) {
    return null
  }

  return (
    <ShellLayout>
      <Outlet />
    </ShellLayout>
  )
}

