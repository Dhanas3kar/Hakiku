import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '../../api/profile'
import type { UserProfile } from '../../api/profile'
import { X } from 'lucide-react'

interface Props {
  profile: UserProfile
  onClose: () => void
}

export function EditProfileModal({ profile, onClose }: Props) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    displayName: profile.displayName || profile.fullName || '',
    department: profile.department || '',
    batch: profile.batch || '',
    bio: profile.bio || '',
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserProfile>) => profileApi.updateMe(data),
    onSuccess: (updatedProfile) => {
      // Invalidate the auth query and the specific profile query
      queryClient.setQueryData(['profile', profile.username], updatedProfile)
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
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

            <div className="grid grid-cols-2 gap-4">
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
                <label htmlFor="batch" className="block text-sm font-medium">
                  Batch (Year)
                </label>
                <input
                  id="batch"
                  name="batch"
                  type="text"
                  placeholder="e.g. 2026"
                  value={formData.batch}
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
