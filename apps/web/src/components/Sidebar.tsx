import { Link } from '@tanstack/react-router'
import {
  Home,
  Compass,
  MessageSquare,
  Bell,
  User,
  Settings,
  LogOut,
  Shield,
  Users,
} from 'lucide-react'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { useAuth } from '../hooks/useAuth'
import ThemeToggle from './ThemeToggle'
import { BrandLogo } from './ui/BrandLogo'
import { Avatar } from './ui/Avatar'
import { cn } from '../lib/cn'
import { toast } from 'sonner'

export function Sidebar() {
  const { logout, user } = useAuth()
  const unreadCounts = useUnreadCounts()

  const profilePath = `/profile/${user?.username || ''}`

  const navItems: Array<{
    label: string
    to: string
    icon: typeof Home
    badge?: number
  }> = [
      {
        label: 'Home',
        to: '/',
        icon: Home,
      },
      {
        label: 'Communities',
        to: '/communities',
        icon: Users,
      },
      {
        label: 'Discover',
        to: '/discover',
        icon: Compass,
      },
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
      {
        label: 'Profile',
        to: profilePath,
        icon: User,
      },
      {
        label: 'Settings',
        to: '/settings',
        icon: Settings,
      },
    ]

  if (user?.role === 'ADMIN' || user?.role === 'MODERATOR') {
    navItems.push({
      label: 'Admin Panel',
      to: '/admin',
      icon: Shield,
    })
  }

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

  return (
    <aside className="sticky top-0 hidden h-dvh w-16 lg:w-60 xl:w-64 shrink-0 flex-col border-r border-border-subtle bg-surface px-2 py-4 lg:px-4 md:flex overflow-hidden justify-between">
      {/* Brand - Pinned Top */}
      <div className="shrink-0 mb-4 px-1">
        <Link
          to="/"
          className="flex items-center justify-center lg:justify-start gap-2 rounded-md px-2 py-1.5 text-foreground no-underline transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="HAKIKU Home"
        >
          <BrandLogo className="h-7" />
        </Link>
      </div>

      {/* Navigation - Scrollable only if height is constrained */}
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              className={cn(
                'group relative flex items-center justify-center lg:justify-start gap-3 rounded-lg px-2.5 py-2.5 lg:px-3.5',
                'text-sm font-medium text-foreground-muted',
                'transition-all duration-150',
                'hover:bg-surface-muted hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
              activeProps={{
                className: cn(
                  'group relative flex items-center justify-center lg:justify-start gap-3 rounded-lg px-2.5 py-2.5 lg:px-3.5',
                  'bg-primary/10 text-primary font-semibold shadow-xs',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                ),
                'aria-current': 'page',
              }}
            >
              <Icon
                className="h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-105"
                strokeWidth={2}
              />

              <span className="min-w-0 flex-1 truncate hidden lg:inline">
                {item.label}
              </span>

              {!!item.badge && item.badge > 0 && (
                <span className="absolute right-1 top-1 lg:static flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-xs">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User / Settings Footer - Pinned Bottom */}
      <div className="shrink-0 mt-auto flex flex-col gap-2.5 border-t border-border-subtle pt-3 bg-surface">
        <Link
          to={profilePath}
          title={user?.displayName || user?.fullName || 'Profile'}
          className="group flex min-w-0 items-center justify-center lg:justify-start gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Avatar
            src={user?.avatarUrl}
            name={
              user?.displayName ||
              user?.fullName ||
              user?.username ||
              'You'
            }
            size="sm"
          />

          <div className="min-w-0 flex-1 hidden lg:block">
            <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {user?.displayName || user?.fullName || 'You'}
            </p>

            {user?.username && (
              <p className="truncate text-xs text-foreground-muted">
                @{user.username}
              </p>
            )}
          </div>
        </Link>

        <div className="flex justify-center lg:justify-start">
          <ThemeToggle />
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="Log Out"
          className={cn(
            'flex w-full items-center justify-center lg:justify-start gap-3 rounded-md px-2.5 py-2.5 lg:px-3',
            'text-sm font-medium text-foreground-muted',
            'transition-colors duration-150',
            'hover:bg-surface-muted hover:text-danger',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger',
            'cursor-pointer',
          )}
        >
          <LogOut
            className="h-5 w-5 shrink-0"
            strokeWidth={1.75}
          />
          <span className="hidden lg:inline">Log Out</span>
        </button>
      </div>
    </aside>
  )
}
