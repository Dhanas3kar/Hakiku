import type { UserProfile } from '../../api/profile'
import { FileText, Link as LinkIcon } from 'lucide-react'

interface Props {
  profile: UserProfile
  isOwnProfile: boolean
}

export function ProfileDetails({ profile, isOwnProfile }: Props) {
  const hasSocialLinks = profile.socialLinks && Object.keys(profile.socialLinks).length > 0

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Main Column */}
      <div className="flex flex-col gap-6 md:col-span-2">
        <div className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <FileText className="h-5 w-5 text-foreground-muted" />
            About
          </h2>
          {profile.bio ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-4 text-sm italic text-foreground-muted/60">
              {isOwnProfile ? "You haven't written a bio yet." : "No bio provided."}
            </p>
          )}
        </div>
      </div>

      {/* Side Column */}
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <LinkIcon className="h-5 w-5 text-foreground-muted" />
            Links
          </h2>
          
          <div className="mt-4 flex flex-col gap-3">
            {hasSocialLinks ? (
              Object.entries(profile.socialLinks!).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="font-medium capitalize">{platform}</span>
                </a>
              ))
            ) : (
              <p className="text-sm italic text-foreground-muted/60">
                No links added.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
