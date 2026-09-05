import { createFileRoute, Outlet, useLocation, useRouter } from '@tanstack/react-router'
import { ShellLayout } from '../layouts/ShellLayout'
import { GlobalToastNotifier } from '../components/GlobalToastNotifier'
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
      queryClient.setQueryData(AUTH_QUERY_KEY, null)
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth'
      })

      const targetLogin = location.pathname.startsWith('/admin') ? '/admin/login' : '/login'
      if (location.pathname !== targetLogin) {
        router.navigate({ to: targetLogin, replace: true })
      }
    }

    window.addEventListener('auth:expired', handleAuthExpired)
    return () => window.removeEventListener('auth:expired', handleAuthExpired)
  }, [location.pathname, queryClient, router])

  useEffect(() => {
    let isMounted = true

    if (status === 'unauthenticated' || status === 'error') {
      const targetLogin = location.pathname.startsWith('/admin') ? '/admin/login' : '/login'
      if (location.pathname !== targetLogin) {
        Promise.resolve().then(() => {
          if (isMounted) router.navigate({ to: targetLogin, search: { redirect: location.pathname }, replace: true })
        })
      }
      return
    }

    if (status === 'needs_onboarding' && needsOnboarding && !location.pathname.startsWith('/onboarding')) {
      Promise.resolve().then(() => {
        if (isMounted) router.navigate({ to: '/onboarding', replace: true })
      })
      return
    }

    if (!needsOnboarding && location.pathname.startsWith('/onboarding') && status === 'authenticated') {
      Promise.resolve().then(() => {
        if (isMounted) router.navigate({ to: '/', replace: true })
      })
    }

    return () => {
      isMounted = false
    }
  }, [status, isAuthenticated, needsOnboarding, location.pathname, router])

  if (status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-foreground-muted" />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center bg-background text-foreground gap-4 px-6 text-center">
        <p className="text-foreground font-medium">We couldn’t reach HAKIKU right now.</p>
        <p className="text-sm text-foreground-muted">Please check your connection and try again.</p>
        <button
          onClick={() => auth.refetchSession()}
          className="h-10 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary-hover"
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
      <GlobalToastNotifier />
      <Outlet />
    </ShellLayout>
  )
}
