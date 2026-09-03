import { createFileRoute, Link, useNavigate, Navigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import ThemeToggle from '../components/ThemeToggle'
import { BrandLogo } from '../components/ui/BrandLogo'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

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
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail.endsWith('@srmist.edu.in') && normalizedEmail !== 'connectxsrm@gmail.com') {
      // In a real app, we might want to set a local error state here
      return
    }
    sendOtpMutation.mutate(normalizedEmail)
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex items-center justify-between p-4 md:p-6">
        <Link to="/" className="flex items-center gap-2 focus-visible:outline-none rounded-md">
          <BrandLogo />
        </Link>
        <ThemeToggle compact />
      </header>

      <main className="flex flex-1 flex-col justify-center px-0 sm:px-6 lg:px-8 pb-12">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-none sm:rounded-xl border-y sm:border border-border bg-surface px-5 py-10 sm:px-10">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-sm text-foreground-muted">
                Sign in with your SRM institutional email.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  Email address
                </label>
                <div className="mt-2 relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="name@srmist.edu.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={sendOtpMutation.isPending}
                    invalid={sendOtpMutation.isError}
                  />
                </div>
                {sendOtpMutation.isError && (
                  <p className="mt-2 text-sm text-danger font-medium" role="alert">
                    {sendOtpMutation.error.message || 'Failed to send OTP'}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={sendOtpMutation.isPending || (!email.includes('@srmist.edu.in') && email !== 'connectxsrm@gmail.com')}
                loading={sendOtpMutation.isPending}
                className="w-full"
              >
                {sendOtpMutation.isPending ? 'Sending...' : 'Send Magic Link / OTP'}
              </Button>
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
