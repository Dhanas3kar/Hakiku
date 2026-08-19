import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { profileApi } from '../../api/profile'
import { useAuth } from '../../hooks/useAuth'
import { TagSelect } from '../profile/TagSelect'

export function OnboardingForm() {
  const { refetchSession } = useAuth()
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    campus: 'KTR', // default value to simplify
    department: '',
    degreeProgram: 'B.Tech', // default value to simplify
    batchYear: '',
    graduationYear: '',
    bio: '',
    skillIds: [] as string[],
    interestIds: [] as string[],
  })

  const onboardingMutation = useMutation({
    mutationFn: (data: any) => profileApi.onboarding(data),
    onSuccess: () => {
      // Re-fetch to update isAuthenticated / needsOnboarding state
      refetchSession()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Parse years to integers before sending
    const payload = {
      ...formData,
      batchYear: parseInt(formData.batchYear, 10),
      graduationYear: formData.graduationYear ? parseInt(formData.graduationYear, 10) : parseInt(formData.batchYear, 10) + 4,
    }

    onboardingMutation.mutate(payload)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleTagsChange = (field: 'skillIds' | 'interestIds', ids: string[]) => {
    setFormData((prev) => ({ ...prev, [field]: ids }))
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Complete your profile</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          Tell us a bit about yourself so others can find you on SRM Connect.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            pattern="^[a-zA-Z0-9_]{3,20}$"
            title="3-20 characters, alphanumeric and underscores only"
            value={formData.username}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
            disabled={onboardingMutation.isPending}
          />
        </div>

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
            disabled={onboardingMutation.isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="campus" className="block text-sm font-medium">
              Campus
            </label>
            <select
              id="campus"
              name="campus"
              required
              value={formData.campus}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
              disabled={onboardingMutation.isPending}
            >
              <option value="KTR">Kattankulathur (KTR)</option>
              <option value="RMP">Ramapuram (RMP)</option>
              <option value="VDP">Vadapalani (VDP)</option>
              <option value="NCR">NCR Modinagar</option>
              <option value="TPR">Tiruchirappalli (TPR)</option>
            </select>
          </div>

          <div>
            <label htmlFor="degreeProgram" className="block text-sm font-medium">
              Degree
            </label>
            <input
              id="degreeProgram"
              name="degreeProgram"
              type="text"
              placeholder="e.g. B.Tech"
              required
              value={formData.degreeProgram}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
              disabled={onboardingMutation.isPending}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="department" className="block text-sm font-medium">
              Department
            </label>
            <input
              id="department"
              name="department"
              type="text"
              placeholder="e.g. Computer Science (CSE)"
              required
              value={formData.department}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
              disabled={onboardingMutation.isPending}
            />
          </div>

          <div>
            <label htmlFor="batchYear" className="block text-sm font-medium">
              Batch (Start Year)
            </label>
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
              className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
              disabled={onboardingMutation.isPending}
            />
          </div>

          <div>
            <label htmlFor="graduationYear" className="block text-sm font-medium">
              Graduation Year
            </label>
            <input
              id="graduationYear"
              name="graduationYear"
              type="number"
              min="2000"
              max="2100"
              placeholder="e.g. 2027"
              required
              value={formData.graduationYear}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
              disabled={onboardingMutation.isPending}
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
            rows={2}
            value={formData.bio}
            onChange={handleChange}
            className="mt-1 block w-full resize-none rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
            disabled={onboardingMutation.isPending}
          />
        </div>

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

        {onboardingMutation.isError && (
          <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">
            {onboardingMutation.error instanceof Error 
              ? onboardingMutation.error.message 
              : 'Failed to save profile. Please check your inputs.'}
          </div>
        )}

        <button
          type="submit"
          disabled={onboardingMutation.isPending || !formData.username || !formData.displayName}
          className="mt-4 flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {onboardingMutation.isPending ? 'Saving...' : 'Complete Setup'}
        </button>
      </form>
    </div>
  )
}
