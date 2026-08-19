import { createFileRoute, Link, useNavigate, Navigate } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import ThemeToggle from '../components/ThemeToggle'

type VerifySearch = {
  email?: string
  redirect?: string
}

export const Route = createFileRoute('/verify-otp')({
  component: VerifyOtpPage,
  validateSearch: (search: Record<string, unknown>): VerifySearch => {
    return {
      email: search.email as string | undefined,
      redirect: search.redirect as string | undefined,
    }
  },
})

function VerifyOtpPage() {
  const navigate = useNavigate()
  const { isAuthenticated, needsOnboarding, refetchSession } = useAuth()
  const { email, redirect } = Route.useSearch()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const verifyOtpMutation = useMutation({
    mutationFn: (otpString: string) => authApi.verifyOtp(email!, otpString),
    onSuccess: async () => {
      // Re-fetch the auth session to populate profile / know if onboarding is needed
      await refetchSession()
      navigate({ to: '/onboarding', replace: true }) // will be intercepted by router if fully onboarded
    },
  })

  if (isAuthenticated && !needsOnboarding) {
    return <Navigate to={redirect || '/'} replace />
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  if (!email) {
    return <Navigate to="/login" replace />
  }

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedOtp = value.replace(/\D/g, '').slice(0, 6).split('')
      const newOtp = [...otp]
      pastedOtp.forEach((char, i) => {
        if (index + i < 6) {
          newOtp[index + i] = char
        }
      })
      setOtp(newOtp)
      const focusIndex = Math.min(index + pastedOtp.length, 5)
      inputRefs.current[focusIndex]?.focus()
      return
    }

    if (!/^\d*$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'Enter') {
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const otpString = otp.join('')
    if (otpString.length !== 6) return
    verifyOtpMutation.mutate(otpString)
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
            <h1 className="text-3xl font-bold tracking-tight">Verify your email</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              We've sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex justify-between gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6} // To handle paste properly
                    value={digit}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="h-12 w-12 rounded-lg border border-border bg-surface-muted text-center text-lg font-semibold text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50 sm:h-14 sm:w-14"
                    disabled={verifyOtpMutation.isPending}
                    aria-label={`Digit ${index + 1}`}
                  />
                ))}
              </div>
              {verifyOtpMutation.isError && (
                <p className="mt-3 text-center text-sm text-danger" role="alert">
                  {verifyOtpMutation.error.message || 'Invalid or expired OTP'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={verifyOtpMutation.isPending || otp.join('').length !== 6}
              className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifyOtpMutation.isPending ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-foreground-muted">
            <Link
              to="/login"
              className="font-semibold text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm"
            >
              Use a different email
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
