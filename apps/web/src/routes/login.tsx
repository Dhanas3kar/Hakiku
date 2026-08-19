import { createFileRoute, Link, useNavigate, useRouter, Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import ThemeToggle from '../components/ThemeToggle'

type LoginSearch = {
  redirect?: string
}

export const Route = createFileRoute('/login')({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    return {
      redirect: search.redirect as string | undefined,
    }
  },
})

function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const { redirect } = Route.useSearch()

  const sendOtpMutation = useMutation({
    mutationFn: (email: string) => authApi.sendOtp(email),
    onSuccess: () => {
      navigate({ 
        to: '/verify-otp', 
        search: { email, redirect },
      })
    },
  })

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to={redirect || '/'} replace />
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim().toLowerCase().endsWith('@srmist.edu.in')) {
      // In a real app, we might want to set a local error state here
      return
    }
    sendOtpMutation.mutate(email)
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex items-center justify-between p-4 md:p-6">
        <Link to="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm">
          <img src="/Dark_theme_logo.png" alt="SRM Connect" className="h-8 w-auto hidden dark:block" />
          <img src="/light_theme_logo.png" alt="SRM Connect" className="h-8 w-auto block dark:hidden" />
          <span className="sr-only">SRM Connect</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Enter your SRM institutional email to sign in
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@srmist.edu.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-surface-muted px-4 py-2.5 text-foreground placeholder-foreground-muted focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
                  disabled={sendOtpMutation.isPending}
                />
              </div>
              {sendOtpMutation.isError && (
                <p className="mt-2 text-sm text-danger" role="alert">
                  {sendOtpMutation.error.message || 'Failed to send OTP'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={sendOtpMutation.isPending || !email.includes('@srmist.edu.in')}
              className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendOtpMutation.isPending ? 'Sending...' : 'Send Magic Link / OTP'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-foreground-muted">
            New to SRM Connect?{' '}
            <Link
              to="/register"
              search={{ redirect }}
              className="font-semibold text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm"
            >
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
