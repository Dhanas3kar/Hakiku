import { createFileRoute } from '@tanstack/react-router'
import { Bell, LogOut, Moon, Sun, Monitor, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, type NotificationCategory, type NotificationPreference } from '../api/notifications'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

type ThemeMode = 'light' | 'dark' | 'auto'

interface PreferenceUpdate {
  category: NotificationCategory
  field: 'isEmailEnabled' | 'isPushEnabled' | 'isInAppEnabled'
  value: boolean
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement

  if (mode === 'auto') {
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches

    root.classList.remove('light', 'dark')
    root.classList.add(prefersDark ? 'dark' : 'light')
    root.removeAttribute('data-theme')
    root.style.colorScheme = prefersDark ? 'dark' : 'light'
    return
  }

  root.classList.remove('light', 'dark')
  root.classList.add(mode)
  root.setAttribute('data-theme', mode)
  root.style.colorScheme = mode
}

function NotificationToggle({
  checked = false,
  disabled = false,
  onChange,
}: {
  checked?: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label
      className={`relative inline-flex shrink-0 items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        }`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />

      <span
        className="
          relative h-5 w-9 rounded-full
          bg-muted
          transition-colors
          peer-checked:bg-primary
          peer-focus-visible:outline-none
          peer-focus-visible:ring-2
          peer-focus-visible:ring-primary/50
          after:absolute
          after:left-[2px]
          after:top-[2px]
          after:h-4
          after:w-4
          after:rounded-full
          after:border
          after:border-border
          after:bg-white
          after:transition-transform
          peer-checked:after:translate-x-4
        "
      />
    </label>
  )
}

function SettingsPage() {
  const { logout } = useAuth()
  const queryClient = useQueryClient()

  const [theme, setTheme] = useState<ThemeMode>('auto')
  const [updatingPreference, setUpdatingPreference] = useState<string | null>(null)

  /*
   * ------------------------------------------------------------
   * Theme
   * ------------------------------------------------------------
   */

  useEffect(() => {
    const stored = window.localStorage.getItem('theme') as ThemeMode | null

    const initialTheme =
      stored && ['light', 'dark', 'auto'].includes(stored)
        ? stored
        : 'auto'

    setTheme(initialTheme)
    applyTheme(initialTheme)

    if (initialTheme !== 'auto') return

    const mediaQuery = window.matchMedia(
      '(prefers-color-scheme: dark)'
    )

    const handleSystemThemeChange = () => {
      applyTheme('auto')
      window.dispatchEvent(new Event('theme-change'))
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [])

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode)

    if (mode === 'auto') {
      window.localStorage.removeItem('theme')
    } else {
      window.localStorage.setItem('theme', mode)
    }

    applyTheme(mode)

    window.dispatchEvent(new Event('theme-change'))
  }

  /*
   * ------------------------------------------------------------
   * Notification Preferences
   * ------------------------------------------------------------
   */

  const {
    data: preferences = [],
    isLoading: prefsLoading,
    isError: prefsError,
    refetch: refetchPreferences,
  } = useQuery<NotificationPreference[]>({
    queryKey: ['settings', 'preferences'],
    queryFn: notificationsApi.getPreferences,
  })

  const updatePreferences = useMutation({
    mutationFn: async ({
      category,
      field,
      value,
    }: PreferenceUpdate) => {
      setUpdatingPreference(`${category}:${field}`)

      return notificationsApi.updatePreference(category, {
        [field]: value,
      })
    },

    onMutate: async ({ category, field, value }) => {
      await queryClient.cancelQueries({
        queryKey: ['settings', 'preferences'],
      })

      const previousPreferences =
        queryClient.getQueryData<NotificationPreference[]>([
          'settings',
          'preferences',
        ])

      queryClient.setQueryData<NotificationPreference[]>(
        ['settings', 'preferences'],
        (current = []) =>
          current.map((preference) =>
            preference.category === category
              ? {
                ...preference,
                [field]: value,
              }
              : preference
          )
      )

      return { previousPreferences }
    },

    onError: (_error, _variables, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(
          ['settings', 'preferences'],
          context.previousPreferences
        )
      }

      toast.error('Failed to update notification preference')
    },

    onSuccess: () => {
      toast.success('Notification preference updated')
    },

    onSettled: () => {
      setUpdatingPreference(null)

      queryClient.invalidateQueries({
        queryKey: ['settings', 'preferences'],
      })
    },
  })

  const handlePreferenceChange = (
    category: NotificationCategory,
    field: PreferenceUpdate['field'],
    value: boolean
  ) => {
    updatePreferences.mutate({
      category,
      field,
      value,
    })
  }

  /*
   * ------------------------------------------------------------
   * Logout
   * ------------------------------------------------------------
   */

  const handleLogout = () => {
    toast('Are you sure you want to log out?', {
      description: 'You will need to sign in again to access HAKIKU.',
      action: {
        label: 'Log Out',
        onClick: () => logout(),
      },
      cancel: {
        label: 'Cancel',
        onClick: () => { },
      },
    })
  }

  /*
   * ------------------------------------------------------------
   * Render
   * ------------------------------------------------------------
   */

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>

        <p className="mt-1 text-sm text-foreground-muted">
          Manage your appearance, notifications, and session.
        </p>
      </div>

      <div className="space-y-6">
        {/* ================================================== */}
        {/* Appearance */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 p-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Sun className="h-4 w-4" />
              Appearance
            </h2>
          </div>

          <div className="space-y-4 p-4">
            <p className="mb-3 text-sm text-foreground-muted">
              Choose how HAKIKU looks to you.
            </p>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                {
                  mode: 'light' as const,
                  icon: Sun,
                  label: 'Light',
                },
                {
                  mode: 'dark' as const,
                  icon: Moon,
                  label: 'Dark',
                },
                {
                  mode: 'auto' as const,
                  icon: Monitor,
                  label: 'System',
                },
              ].map(({ mode, icon: Icon, label }) => {
                const active = theme === mode

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleThemeChange(mode)}
                    className={`
                      flex min-h-[82px]
                      flex-col items-center justify-center
                      rounded-lg border-2
                      p-3
                      transition-colors
                      ${active
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-transparent text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    <Icon className="mb-2 h-5 w-5 sm:h-6 sm:w-6" />

                    <span className="text-xs font-medium sm:text-sm">
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* ================================================== */}
        {/* Notifications */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 p-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Bell className="h-4 w-4" />
              Notifications
            </h2>
          </div>

          <div className="p-4">
            {prefsLoading ? (
              <div className="animate-pulse space-y-6">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="space-y-3"
                  >
                    <div className="h-4 w-32 rounded bg-muted" />
                    <div className="h-12 w-full rounded-lg bg-muted" />
                    <div className="h-12 w-full rounded-lg bg-muted" />
                    <div className="h-12 w-full rounded-lg bg-muted" />
                  </div>
                ))}
              </div>
            ) : prefsError ? (
              <div className="flex items-start gap-3 rounded-lg bg-destructive/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />

                <div className="min-w-0">
                  <p className="text-sm font-medium text-destructive">
                    Failed to load preferences
                  </p>

                  <p className="mt-1 text-xs text-destructive/80">
                    Make sure the backend is reachable and try again.
                  </p>

                  <button
                    type="button"
                    onClick={() => refetchPreferences()}
                    className="mt-3 text-xs font-semibold text-destructive underline underline-offset-2"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : preferences.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-foreground-muted" />

                <p className="mt-3 text-sm font-medium text-foreground">
                  No notification preferences found
                </p>

                <p className="mt-1 text-xs text-foreground-muted">
                  Notification settings will appear here when available.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {preferences.map((pref) => (
                  <div
                    key={pref.category}
                    className="space-y-4 border-b border-border pb-5 last:border-0 last:pb-0"
                  >
                    <h3 className="text-sm font-semibold capitalize text-foreground">
                      {pref.category
                        .replace(/_/g, ' ')
                        .toLowerCase()}{' '}
                      Notifications
                    </h3>

                    {/* In-App */}
                    <div className="flex items-center justify-between gap-4 rounded-lg p-2 sm:ml-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          In-App
                        </p>

                        <p className="mt-0.5 text-xs text-foreground-muted">
                          Receive notifications within the app.
                        </p>
                      </div>

                      <NotificationToggle
                        checked={Boolean(pref.isInAppEnabled)}
                        disabled={
                          updatingPreference ===
                          `${pref.category}:isInAppEnabled`
                        }
                        onChange={(value) =>
                          handlePreferenceChange(
                            pref.category,
                            'isInAppEnabled',
                            value
                          )
                        }
                      />
                    </div>

                    {/* Email */}
                    <div className="flex items-center justify-between gap-4 rounded-lg p-2 sm:ml-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          Email
                        </p>

                        <p className="mt-0.5 text-xs text-foreground-muted">
                          Receive emails for these events.
                        </p>
                      </div>

                      <NotificationToggle
                        checked={Boolean(pref.isEmailEnabled)}
                        disabled={
                          updatingPreference ===
                          `${pref.category}:isEmailEnabled`
                        }
                        onChange={(value) =>
                          handlePreferenceChange(
                            pref.category,
                            'isEmailEnabled',
                            value
                          )
                        }
                      />
                    </div>

                    {/* Push */}
                    <div className="flex items-center justify-between gap-4 rounded-lg p-2 sm:ml-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          Push
                        </p>

                        <p className="mt-0.5 text-xs text-foreground-muted">
                          Receive push notifications on your devices.
                        </p>
                      </div>

                      <NotificationToggle
                        checked={Boolean(pref.isPushEnabled)}
                        disabled={
                          updatingPreference ===
                          `${pref.category}:isPushEnabled`
                        }
                        onChange={(value) =>
                          handlePreferenceChange(
                            pref.category,
                            'isPushEnabled',
                            value
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ================================================== */}
        {/* Session */}
        {/* ================================================== */}

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 p-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <LogOut className="h-4 w-4" />
              Session
            </h2>
          </div>

          <div className="p-4">
            <p className="mb-4 text-sm text-foreground-muted">
              Log out of your current session on this device.
            </p>

            <button
              type="button"
              onClick={handleLogout}
              className="
                inline-flex h-10
                items-center justify-center
                gap-2
                whitespace-nowrap
                rounded-md
                border border-destructive
                bg-transparent
                px-4 py-2
                text-sm font-medium
                text-destructive
                transition-colors
                hover:bg-destructive/10
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-focus
                focus-visible:ring-offset-2
              "
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

