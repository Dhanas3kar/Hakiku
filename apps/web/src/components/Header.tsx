import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Menu,
  X,
  Home,
  Compass,
  MessageSquare,
  Bell,
  Settings,
  LogOut,
  Shield,
  ChevronRight,
  Users,
  User,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import ThemeToggle from './ThemeToggle'
import { Avatar } from './ui/Avatar'
import { BrandLogo } from './ui/BrandLogo'
import { toast } from 'sonner'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { logout, user } = useAuth()
  const unreadCounts = useUnreadCounts()
  const navigate = useNavigate()

  const profilePath = `/profile/${user?.username || ''}`

  const navItems = [
    { label: 'Home', to: '/', icon: Home },
    { label: 'Communities', to: '/communities', icon: Users },
    { label: 'Discover', to: '/discover', icon: Compass },
    {
      label: 'Messages',
      to: '/messages',
      icon: MessageSquare,
      badge: unreadCounts.messages,
    },
    {
      label: 'Notifications',
      to: '/notifications',
      icon: Bell,
      badge: unreadCounts.notifications,
    },
    { label: 'Profile', to: profilePath, icon: User },
    { label: 'Settings', to: '/settings', icon: Settings },
  ]

  if (user?.role === 'ADMIN' || user?.role === 'MODERATOR') {
    navItems.push({
      label: 'Admin Panel',
      to: '/admin',
      icon: Shield,
    })
  }

  const closeDrawer = () => setIsOpen(false)

  const handleNavigate = (to: string) => {
    closeDrawer()

    // Allow the drawer exit animation to finish before navigation.
    window.setTimeout(() => {
      navigate({ to })
    }, 160)
  }

  const handleLogout = () => {
    closeDrawer()

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

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/90 px-4 backdrop-blur-md md:hidden">
        <nav className="flex w-full items-center justify-between py-2.5">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center justify-center rounded-lg p-2 text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            aria-label="Open navigation menu"
            aria-expanded={isOpen}
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link
            to="/"
            className="inline-flex items-center text-foreground no-underline"
            aria-label="HAKIKU Home"
          >
            <BrandLogo className="h-6" />
          </Link>

          <ThemeToggle compact />
        </nav>
      </header>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            {/* Backdrop */}
            <motion.button
              type="button"
              aria-label="Close navigation menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 h-full w-full cursor-default bg-black/65 backdrop-blur-xs"
              onClick={closeDrawer}
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{
                type: 'spring',
                damping: 26,
                stiffness: 300,
              }}
              className="relative z-10 flex h-[100dvh] w-[290px] max-w-[85vw] flex-col overflow-hidden border-r border-border bg-surface shadow-2xl"
              aria-label="Mobile navigation"
            >
              {/* Profile Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-elevated/40 p-4">
                <button
                  type="button"
                  onClick={() => handleNavigate(profilePath)}
                  className="group flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                >
                  <Avatar
                    src={user?.avatarUrl}
                    name={
                      user?.displayName ||
                      user?.fullName ||
                      user?.username ||
                      'You'
                    }
                    size="md"
                    className="shrink-0 border border-border"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-foreground transition-colors group-hover:text-primary">
                      {user?.displayName || user?.fullName || 'You'}
                    </p>

                    {user?.username && (
                      <p className="truncate text-xs text-foreground-muted">
                        @{user.username}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" />
                </button>

                <button
                  type="button"
                  onClick={closeDrawer}
                  className="ml-2 shrink-0 rounded-full p-2 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:thin]">
                <div className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon

                    return (
                      <button
                        key={item.to}
                        type="button"
                        onClick={() => handleNavigate(item.to)}
                        className="group flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-base font-medium text-foreground-muted transition-all duration-150 hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                      >
                        <Icon
                          className="h-5 w-5 shrink-0 text-foreground-muted transition-transform duration-150 group-hover:scale-105 group-hover:text-foreground"
                          strokeWidth={2}
                        />

                        <span className="flex-1 truncate font-semibold">
                          {item.label}
                        </span>

                        {!!item.badge && item.badge > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </nav>

              {/* Footer */}
              <div className="shrink-0 space-y-3 border-t border-border bg-surface-elevated/50 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm font-medium text-foreground-muted">
                    Appearance
                  </span>

                  <ThemeToggle compact />
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger shadow-xs transition-all hover:bg-danger hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger active:scale-[0.98] cursor-pointer"
                >
                  <LogOut
                    className="h-4 w-4 shrink-0"
                    strokeWidth={2.2}
                  />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

