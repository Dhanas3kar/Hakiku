import { useState, useRef } from 'react'
import { profileApi } from '../../api/profile'
import { useAuth } from '../../hooks/useAuth'
import { TagSelect } from '../profile/TagSelect'
import { User, Upload, ArrowRight, ArrowLeft, Link as LinkIcon, Globe, Briefcase } from 'lucide-react'

export function OnboardingForm() {
  const { refetchSession } = useAuth()
  
  // Steps: 1 = Basic Info, 2 = Avatar, 3 = Extras
  const [step, setStep] = useState(1)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    campus: 'KTR',
    department: '',
    degreeProgram: 'B.Tech',
    batchYear: '',
    graduationYear: '',
    bio: '',
    skillIds: [] as string[],
    interestIds: [] as string[],
    socialLinks: {
      website: '',
      github: '',
      linkedin: ''
    }
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleTagsChange = (field: 'skillIds' | 'interestIds', ids: string[]) => {
    setFormData((prev) => ({ ...prev, [field]: ids }))
  }

  const handleSocialLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [name]: value },
    }))
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 3) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        ...formData,
        batchYear: parseInt(formData.batchYear, 10),
        graduationYear: formData.graduationYear ? parseInt(formData.graduationYear, 10) : parseInt(formData.batchYear, 10) + 4,
      }

      // 1. Create Profile
      await profileApi.onboarding(payload)

      // 2. Upload Avatar if selected
      if (avatarFile) {
        await profileApi.uploadAvatar(avatarFile)
      }

      // 3. Update session and redirect
      await refetchSession()
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to complete setup. Please check your inputs.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 shadow-sm sm:p-8">
      {/* Progress Indicator */}
      <div className="mb-8 flex items-center justify-between">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-foreground-muted'}`}>
              {s}
            </div>
            {s < 3 && (
              <div className={`mx-2 h-1 w-12 rounded-full transition-colors ${step > s ? 'bg-primary' : 'bg-surface-muted'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {step === 1 && 'Complete your profile'}
          {step === 2 && 'Add a photo'}
          {step === 3 && 'Add more details'}
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {step === 1 && 'Tell us a bit about yourself.'}
          {step === 2 && 'Upload a profile photo so people can recognize you.'}
          {step === 3 && 'Optional details to help others find you.'}
        </p>
      </div>

      {step === 1 && (
        <form onSubmit={handleNext} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <div>
            <label htmlFor="username" className="block text-sm font-medium">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              pattern="^[a-zA-Z0-9_]{3,20}$"
              title="3-20 characters, alphanumeric and underscores only"
              value={formData.username}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium">Full Name</label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              value={formData.displayName}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="department" className="block text-sm font-medium">Department</label>
              <input
                id="department"
                name="department"
                type="text"
                placeholder="e.g. CSE"
                required
                value={formData.department}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>

            <div>
              <label htmlFor="batchYear" className="block text-sm font-medium">Batch (Year)</label>
              <input
                id="batchYear"
                name="batchYear"
                type="number"
                min="2000"
                max="2100"
                placeholder="e.g. 2023"
                required
                value={formData.batchYear}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>

            <div>
              <label htmlFor="degreeProgram" className="block text-sm font-medium">Degree</label>
              <input
                id="degreeProgram"
                name="degreeProgram"
                type="text"
                placeholder="e.g. B.Tech"
                required
                value={formData.degreeProgram}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium">Bio</label>
            <textarea
              id="bio"
              name="bio"
              rows={2}
              value={formData.bio}
              onChange={handleChange}
              className="mt-1 block w-full resize-none rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>

          <button
            type="submit"
            disabled={!formData.username || !formData.displayName || !formData.department || !formData.batchYear}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleNext} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex flex-col items-center justify-center gap-4 py-6">
            <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-surface bg-surface-muted shadow-sm flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-16 w-16 text-foreground-muted/50" />
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                <Upload className="h-6 w-6" />
              </div>
            </div>
            
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="text-sm font-medium text-primary hover:underline"
            >
              {avatarPreview ? 'Change Photo' : 'Upload Photo'}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="submit"
              disabled={!avatarFile}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleFinalSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Social Links (Optional)</h3>
            <div>
              <label htmlFor="website" className="block text-xs font-medium text-foreground-muted mb-1 flex items-center gap-1.5"><LinkIcon className="h-3 w-3"/> Website</label>
              <input id="website" name="website" type="url" placeholder="https://yourwebsite.com" value={formData.socialLinks.website} onChange={handleSocialLinkChange} className="block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus" disabled={isSubmitting} />
            </div>
            <div>
              <label htmlFor="github" className="block text-xs font-medium text-foreground-muted mb-1 flex items-center gap-1.5"><Globe className="h-3 w-3"/> GitHub</label>
              <input id="github" name="github" type="url" placeholder="https://github.com/username" value={formData.socialLinks.github} onChange={handleSocialLinkChange} className="block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus" disabled={isSubmitting} />
            </div>
            <div>
              <label htmlFor="linkedin" className="block text-xs font-medium text-foreground-muted mb-1 flex items-center gap-1.5"><Briefcase className="h-3 w-3"/> LinkedIn</label>
              <input id="linkedin" name="linkedin" type="url" placeholder="https://linkedin.com/in/username" value={formData.socialLinks.linkedin} onChange={handleSocialLinkChange} className="block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus" disabled={isSubmitting} />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Skills & Interests (Optional)</h3>
            <TagSelect
              label="Skills"
              placeholder="Search skills (e.g. React, TypeScript)..."
              selectedIds={formData.skillIds}
              onChange={(ids) => handleTagsChange('skillIds', ids)}
              fetchFn={async (query) => {
                const res = await profileApi.searchSkills(query, 5)
                return res.map((s: any) => ({ id: s.id, name: s.name, category: s.category }))
              }}
            />
            <TagSelect
              label="Interests"
              placeholder="Search interests (e.g. Web Development, AI)..."
              selectedIds={formData.interestIds}
              onChange={(ids) => handleTagsChange('interestIds', ids)}
              fetchFn={async (query) => {
                const res = await profileApi.searchInterests(query, 5)
                return res.map((i: any) => ({ id: i.id, name: i.name, category: i.category }))
              }}
            />
          </div>

          {submitError && (
            <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">
              {submitError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
