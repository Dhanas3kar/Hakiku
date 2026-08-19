import { createFileRoute, Outlet, useLocation, useRouter } from '@tanstack/react-router'
import { ShellLayout } from '../layouts/ShellLayout'
import { useAuth } from '../hooks/useAuth'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const auth = useAuth()
  const { isAuthenticated, needsOnboarding, status } = auth
  const location = useLocation()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated' || (!isAuthenticated && status !== 'loading')) {
      router.navigate({ to: '/login', search: { redirect: location.pathname }, replace: true })
    } else if (needsOnboarding && !location.pathname.startsWith('/onboarding')) {
      router.navigate({ to: '/onboarding', replace: true })
    } else if (!needsOnboarding && location.pathname.startsWith('/onboarding') && status === 'authenticated') {
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

  if (status === 'unauthenticated' || !isAuthenticated) {
    return null
  }

  return (
    <ShellLayout>
      <Outlet />
    </ShellLayout>
  )
}

