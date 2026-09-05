import type { UserProfile } from '../../api/profile'
import { FileText, Globe, ExternalLink } from 'lucide-react'
import { FormattedContent } from '../ui/FormattedContent'

interface Props {
  profile: UserProfile
  isOwnProfile: boolean
}

export function ProfileDetails({ profile, isOwnProfile }: Props) {
  const hasSkills = profile.skills && profile.skills.length > 0
  const hasInterests = profile.interests && profile.interests.length > 0
  const hasSocialLinks = profile.socialLinks && Object.values(profile.socialLinks).some(url => url && typeof url === 'string' && url.trim().length > 0)

  const aboutText = profile.about || null

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* About Section */}
      <div className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <FileText className="h-5 w-5 text-foreground-muted" />
          About
        </h2>
        {aboutText ? (
          <div className="mt-4 text-sm leading-relaxed text-foreground-muted">
            <FormattedContent content={aboutText} />
          </div>
        ) : (
          <p className="mt-4 text-sm italic text-foreground-muted/60">
            {isOwnProfile ? "You haven't written an about section yet." : "No about information provided."}
          </p>
        )}
      </div>

      {/* Skills Section */}
      {hasSkills && (
        <div className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Skills</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.skills!.map((skill) => (
              <span key={skill.id} className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {skill.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Interests Section */}
      {hasInterests && (
        <div className="rounded-xl border border-border bg-surface-elevated p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Interests</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.interests!.map((interest) => (
              <span key={interest.id} className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
                {interest.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
