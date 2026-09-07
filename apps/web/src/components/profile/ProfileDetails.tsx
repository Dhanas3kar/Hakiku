import type { UserProfile } from '../../api/profile'
import { FileText } from 'lucide-react'
import { FormattedContent } from '../ui/FormattedContent'

interface Props {
  profile: UserProfile
  isOwnProfile: boolean
}

export function ProfileDetails({
  profile,
  isOwnProfile,
}: Props) {
  const skills = profile.skills ?? []
  const interests = profile.interests ?? []

  const aboutText = profile.about?.trim() || null

  return (
    <div className="flex w-full flex-col gap-4 sm:gap-5 lg:gap-6">
      {/* About */}
      <section className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>

          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            About
          </h2>
        </div>

        {aboutText ? (
          <div className="mt-3 text-sm leading-7 text-foreground-muted sm:mt-4">
            <FormattedContent content={aboutText} />
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-surface-muted/50 px-3.5 py-3 sm:mt-4 sm:px-4 sm:py-3.5">
            <p className="text-sm italic leading-relaxed text-foreground-muted/70">
              {isOwnProfile
                ? "You haven't written an about section yet."
                : 'No about information provided.'}
            </p>
          </div>
        )}
      </section>

      {/* Skills */}
      {skills.length > 0 && (
        <section className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              Skills
            </h2>

            <span className="text-xs text-foreground-muted">
              {skills.length}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
            {skills.map((skill) => (
              <span
                key={skill.id}
                className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15 sm:px-3 sm:text-sm"
              >
                {skill.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Interests */}
      {interests.length > 0 && (
        <section className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              Interests
            </h2>

            <span className="text-xs text-foreground-muted">
              {interests.length}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
            {interests.map((interest) => (
              <span
                key={interest.id}
                className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/15 sm:px-3 sm:text-sm"
              >
                {interest.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

