import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '../../api/profile'
import type { UserProfile } from '../../api/profile'
import { X } from 'lucide-react'
import { TagSelect } from './TagSelect'
import { toast } from 'sonner'

interface Props {
  profile: UserProfile
  onClose: () => void
}

export function EditProfileModal({ profile, onClose }: Props) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    displayName: profile.displayName || profile.fullName || '',
    department: profile.department || '',
    batchYear: profile.batchYear || profile.batch || '',
    bio: profile.bio || '',
    skillIds: profile.skills?.map((s) => s.id) || [],
    interestIds: profile.interests?.map((i) => i.id) || [],
    socialLinks: {
      website: profile.socialLinks?.website || '',
      github: profile.socialLinks?.github || '',
      linkedin: profile.socialLinks?.linkedin || '',
    },
  })

  const handleTagsChange = (field: 'skillIds' | 'interestIds', ids: string[]) => {
    setFormData((prev) => ({ ...prev, [field]: ids }))
  }

  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserProfile>) => profileApi.updateMe(data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['profile', profile.username] })
      await queryClient.cancelQueries({ queryKey: ['auth', 'me'] })

      const previousProfile = queryClient.getQueryData(['profile', profile.username])
      const previousAuth = queryClient.getQueryData(['auth', 'me'])

      if (previousProfile) {
        queryClient.setQueryData(['profile', profile.username], {
          ...(previousProfile as any),
          ...newData,
        })
      }
      if (previousAuth) {
        queryClient.setQueryData(['auth', 'me'], {
          ...(previousAuth as any),
          user: {
            ...(previousAuth as any).user,
            ...newData,
          }
        })
      }

      onClose() // Optimistic close

      return { previousProfile, previousAuth }
    },
    onError: (_err, _newData, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(['profile', profile.username], context.previousProfile)
      }
      if (context?.previousAuth) {
        queryClient.setQueryData(['auth', 'me'], context.previousAuth)
      }
      toast.error('Failed to update profile. Please try again.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profile.username] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ...formData,
      batchYear: formData.batchYear === '' ? undefined : Number(formData.batchYear)
    }
    updateMutation.mutate(payload)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value
    setFormData((prev) => ({ ...prev, [e.target.name]: value }))
  }

  const handleSocialLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [name]: value },
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-0">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface-elevated shadow-xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between border-b border-border p-4 sm:p-6 shrink-0">
          <h2 className="text-xl font-bold text-foreground">Edit Profile</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <form id="edit-profile-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium">
                Full Name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={formData.displayName}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
                disabled={updateMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="department" className="block text-sm font-medium">
                  Department
                </label>
                <input
                  id="department"
                  name="department"
                  type="text"
                  placeholder="e.g. CSE"
                  value={formData.department}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
                  disabled={updateMutation.isPending}
                />
              </div>

              <div>
                <label htmlFor="batchYear" className="block text-sm font-medium">
                  Batch (Year)
                </label>
                <input
                  id="batchYear"
                  name="batchYear"
                  type="number"
                  placeholder="e.g. 2026"
                  value={formData.batchYear || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium">
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                value={formData.bio}
                onChange={handleChange}
                className="mt-1 block w-full resize-none rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
                disabled={updateMutation.isPending}
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Social Links</h3>
              <div>
                <label htmlFor="website" className="block text-xs font-medium text-foreground-muted mb-1">
                  Website
                </label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={formData.socialLinks.website}
                  onChange={handleSocialLinkChange}
                  className="block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
                  disabled={updateMutation.isPending}
                />
              </div>
              <div>
                <label htmlFor="github" className="block text-xs font-medium text-foreground-muted mb-1">
                  GitHub
                </label>
                <input
                  id="github"
                  name="github"
                  type="url"
                  placeholder="https://github.com/username"
                  value={formData.socialLinks.github}
                  onChange={handleSocialLinkChange}
                  className="block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
                  disabled={updateMutation.isPending}
                />
              </div>
              <div>
                <label htmlFor="linkedin" className="block text-xs font-medium text-foreground-muted mb-1">
                  LinkedIn
                </label>
                <input
                  id="linkedin"
                  name="linkedin"
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={formData.socialLinks.linkedin}
                  onChange={handleSocialLinkChange}
                  className="block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>
            
            <TagSelect
              label="Skills"
              placeholder="Search skills (e.g. React, TypeScript)..."
              selectedIds={formData.skillIds}
              initialTags={profile.skills?.map(s => ({ id: s.id, name: s.name, category: s.category }))}
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
              initialTags={profile.interests?.map(i => ({ id: i.id, name: i.name, category: i.category }))}
              onChange={(ids) => handleTagsChange('interestIds', ids)}
              fetchFn={async (query) => {
                const res = await profileApi.searchInterests(query, 5)
                return res.map((i: any) => ({ id: i.id, name: i.name, category: i.category }))
              }}
            />
            
            {updateMutation.isError && (
              <p className="text-sm text-danger" role="alert">
                {updateMutation.error.message || 'Failed to update profile.'}
              </p>
            )}
          </form>
        </div>

        <div className="border-t border-border bg-surface p-4 sm:p-6 shrink-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            disabled={updateMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-profile-form"
            disabled={updateMutation.isPending || !formData.displayName}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
