import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { profileApi } from '../api/profile'
import { useAuth } from '../hooks/useAuth'
import { ProfileHeader } from '../components/profile/ProfileHeader'
import { ProfileDetails } from '../components/profile/ProfileDetails'
import { ProfilePosts } from '../components/profile/ProfilePosts'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/profile/$username')({
  component: ProfilePage,
})

function ProfilePage() {
  const { username } = Route.useParams()
  const { user: currentUser } = useAuth()
  
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => profileApi.getByUsername(username),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex w-full flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-bold text-foreground">Profile not found</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          The user "{username}" does not exist or is unavailable.
        </p>
      </div>
    )
  }

  const isOwnProfile = currentUser?.username === profile.username

  return (
    <div className="flex w-full flex-col gap-6 pb-12">
      <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />
      <ProfileDetails profile={profile} isOwnProfile={isOwnProfile} />
      <ProfilePosts profile={profile} isOwnProfile={isOwnProfile} />
    </div>
  )
}
