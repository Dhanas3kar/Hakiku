import { createFileRoute } from '@tanstack/react-router'
import { Bell, LogOut, Moon, Sun, Monitor, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { client } from '../api/client'
import { useAuth } from '../hooks/useAuth'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

type ThemeMode = 'light' | 'dark' | 'auto'

function SettingsPage() {
  const { logout } = useAuth()
  const [theme, setTheme] = useState<ThemeMode>('auto')
  
  // Notification Preferences State (Assuming existing phase 7 backend structure)
  // GET /profile/me/preferences
  const { data: preferences, isLoading: prefsLoading, isError: prefsError } = useQuery({
    queryKey: ['settings', 'preferences'],
    queryFn: async () => {
      const res = await client.get('/profile/me/preferences')
      return res
    },
    retry: 1
  })

  const queryClient = useQueryClient()
  
  const updatePreferences = useMutation({
    mutationFn: async (newPrefs: any) => {
      const res = await client.patch('/profile/me/preferences', newPrefs)
      return res
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings', 'preferences'], data)
    }
  })

  useEffect(() => {
    const stored = window.localStorage.getItem('theme') as ThemeMode | null
    if (stored && ['light', 'dark', 'auto'].includes(stored)) {
      setTheme(stored)
    }
  }, [])

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode)
    const root = document.documentElement
    
    if (mode === 'auto') {
      window.localStorage.removeItem('theme')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.remove('light', 'dark')
      root.classList.add(prefersDark ? 'dark' : 'light')
      root.removeAttribute('data-theme')
      root.style.colorScheme = prefersDark ? 'dark' : 'light'
    } else {
      window.localStorage.setItem('theme', mode)
      root.classList.remove('light', 'dark')
      root.classList.add(mode)
      root.setAttribute('data-theme', mode)
      root.style.colorScheme = mode
    }
    
    // Dispatch custom event if ThemeToggle component listens
    window.dispatchEvent(new Event('theme-change'))
  }

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout()
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-foreground-muted mt-1">Manage your appearance, notifications, and session.</p>
      </div>

      <div className="space-y-6">
        {/* Appearance Section */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Sun className="h-4 w-4" /> Appearance
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-foreground-muted mb-3">Choose how SRM Connect looks to you.</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${theme === 'light' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-transparent text-foreground hover:bg-muted/50'}`}
              >
                <Sun className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${theme === 'dark' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-transparent text-foreground hover:bg-muted/50'}`}
              >
                <Moon className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Dark</span>
              </button>
              <button
                onClick={() => handleThemeChange('auto')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${theme === 'auto' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-transparent text-foreground hover:bg-muted/50'}`}
              >
                <Monitor className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">System</span>
              </button>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {prefsLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-10 bg-muted rounded-md w-full"></div>
                <div className="h-10 bg-muted rounded-md w-full"></div>
              </div>
            ) : prefsError ? (
              <div className="rounded-md bg-destructive/10 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Failed to load preferences</p>
                  <p className="text-xs text-destructive/80 mt-1">Make sure backend /profile/me/preferences is implemented.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Email Notifications</p>
                    <p className="text-sm text-foreground-muted">Receive emails for important activity.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={preferences?.emailNotifications ?? true}
                      onChange={(e) => updatePreferences.mutate({ emailNotifications: e.target.checked })}
                      disabled={updatePreferences.isPending}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-90 hover:opacity-100 disabled:opacity-50"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Push Notifications</p>
                    <p className="text-sm text-foreground-muted">Receive push notifications on this device.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={preferences?.pushNotifications ?? true}
                      onChange={(e) => updatePreferences.mutate({ pushNotifications: e.target.checked })}
                      disabled={updatePreferences.isPending}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-90 hover:opacity-100 disabled:opacity-50"></div>
                  </label>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Session Section */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <LogOut className="h-4 w-4" /> Session
            </h2>
          </div>
          <div className="p-4">
             <p className="text-sm text-foreground-muted mb-4">
              Log out of your current session on this device.
            </p>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-destructive bg-transparent hover:bg-destructive/10 text-destructive h-10 px-4 py-2"
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
