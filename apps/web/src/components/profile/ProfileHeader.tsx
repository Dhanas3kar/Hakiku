import type { UserProfile } from '../../api/profile'
import { User, Edit2, Upload } from 'lucide-react'
import { useState } from 'react'
import { EditProfileModal } from './EditProfileModal'

interface Props {
  profile: UserProfile
  isOwnProfile: boolean
}

export function ProfileHeader({ profile, isOwnProfile }: Props) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // In a real implementation we would hook up image uploads
  const handleCoverUpload = () => {
    // Open file dialog and use profileApi.uploadCover
  }

  const handleAvatarUpload = () => {
    // Open file dialog and use profileApi.uploadAvatar
  }

  return (
    <div className="relative flex flex-col rounded-xl border border-border bg-surface-elevated shadow-sm overflow-hidden">
      {/* Cover Image */}
      <div className="group relative h-32 w-full bg-surface-muted sm:h-48">
        {profile.coverUrl ? (
          <img src={profile.coverUrl} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-primary/20 to-accent/20" />
        )}
        {isOwnProfile && (
          <button 
            onClick={handleCoverUpload}
            className="absolute right-4 top-4 rounded-md bg-black/50 p-2 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 group-hover:opacity-100"
            aria-label="Change cover photo"
          >
            <Upload className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Avatar & Info */}
      <div className="relative px-4 pb-6 sm:px-6">
        <div className="flex justify-between items-start">
          {/* Avatar */}
          <div className="group relative -mt-12 sm:-mt-16">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-surface-elevated bg-surface-muted sm:h-32 sm:w-32">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
              ) : (
                <User className="h-12 w-12 text-foreground-muted sm:h-16 sm:w-16" />
              )}
            </div>
            {isOwnProfile && (
              <button 
                onClick={handleAvatarUpload}
                className="absolute bottom-0 right-0 rounded-full border-2 border-surface-elevated bg-surface p-2 text-foreground-muted shadow-sm transition-colors hover:text-foreground"
                aria-label="Change profile photo"
              >
                <Upload className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            {isOwnProfile ? (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Edit2 className="h-4 w-4" />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
            ) : (
              <button className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated">
                Connect
              </button>
            )}
          </div>
        </div>

        {/* Text Details */}
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-foreground">{profile.displayName || profile.fullName}</h1>
          <p className="text-foreground-muted">@{profile.username}</p>
          
          {(profile.department || profile.batch) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground-muted">
              {profile.department && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {profile.department}
                </span>
              )}
              {profile.batch && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Class of {profile.batch}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isEditModalOpen && (
        <EditProfileModal 
          profile={profile} 
          onClose={() => setIsEditModalOpen(false)} 
        />
      )}
    </div>
  )
}
