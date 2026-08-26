import { createFileRoute, Link, useNavigate, Navigate } from '@tanstack/react-router'
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
  const { isAuthenticated, needsOnboarding } = useAuth()
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
    return <Navigate to={needsOnboarding ? '/onboarding' : (redirect || '/')} replace />
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
          <img src="/Dark_theme_logo.png" alt="HAKIKU" className="h-8 w-auto hidden dark:block" />
          <img src="/light_theme_logo.png" alt="HAKIKU" className="h-8 w-auto block dark:hidden" />
          <span className="sr-only">HAKIKU</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center px-0 sm:px-6 lg:px-8 pb-12">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-none sm:rounded-2xl border-y sm:border border-border bg-surface sm:bg-surface-elevated px-4 py-8 sm:px-10 shadow-none sm:shadow-sm dark:shadow-none">
            <div className="mb-8 text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-sm text-foreground-muted font-medium">
                Enter your SRM institutional email to sign in
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-foreground">
                  Email address
                </label>
                <div className="mt-2 relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="name@srmist.edu.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-border bg-surface-muted px-4 py-3 text-foreground placeholder-foreground-subtle focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50 transition-colors"
                    disabled={sendOtpMutation.isPending}
                  />
                </div>
                {sendOtpMutation.isError && (
                  <p className="mt-2 text-sm text-danger font-medium" role="alert">
                    {sendOtpMutation.error.message || 'Failed to send OTP'}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={sendOtpMutation.isPending || !email.includes('@srmist.edu.in')}
                className="flex w-full justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {sendOtpMutation.isPending ? 'Sending...' : 'Send Magic Link / OTP'}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-sm text-foreground-muted font-medium">
            New to HAKIKU?{' '}
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
