import { createFileRoute, Navigate } from '@tanstack/react-router'
import { OnboardingForm } from '../components/onboarding/OnboardingForm'
import { useAuth } from '../hooks/useAuth'

export const Route = createFileRoute('/_authenticated/onboarding')({
  component: OnboardingPage,
})

function OnboardingPage() {
  const { needsOnboarding } = useAuth()

  // If they somehow land here and don't need onboarding, send them home
  if (!needsOnboarding) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex w-full flex-col items-center justify-center py-12 md:py-24">
      <OnboardingForm />
    </div>
  )
}
