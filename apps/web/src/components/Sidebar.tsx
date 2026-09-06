import { Link } from '@tanstack/react-router'
import { Home, Compass, MessageSquare, Bell, User, Settings, LogOut, Shield, Users } from 'lucide-react'
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
  const navItems: Array<{
    label: string
    to: string
    icon: typeof Home
    badge?: number
  }> = [
    { label: 'Home', to: '/', icon: Home },
    { label: 'Communities', to: '/communities', icon: Users },
    { label: 'Discover', to: '/discover', icon: Compass },
    { label: 'Messages', to: '/messages', icon: MessageSquare, badge: unreadCounts.messages },
    { label: 'Notifications', to: '/notifications', icon: Bell, badge: unreadCounts.notifications },
    { label: 'Profile', to: `/profile/${user?.username || ''}`, icon: User },
    { label: 'Settings', to: '/settings', icon: Settings },
  ]
  if (user?.role === 'ADMIN') {
    navItems.push({ label: 'Admin', to: '/admin', icon: Shield })
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
        onClick: () => {},
      },
    })
  }

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border-subtle bg-surface px-4 py-6 md:flex h-[100dvh] sticky top-0 overflow-y-auto">
      <Link
        to="/"
        className="mb-10 flex items-center gap-2 px-2 text-foreground no-underline focus-visible:outline-none rounded-md"
      >
        <BrandLogo className="h-7" />
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-foreground-muted transition-all duration-150 hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative"
            activeProps={{
              className: 'bg-primary/10 text-primary font-semibold shadow-xs',
              'aria-current': 'page',
            }}
          >
            <item.icon className="h-[18px] w-[18px] transition-transform duration-150 group-hover:scale-105" strokeWidth={2} />
            <span className="flex-1">{item.label}</span>
            {!!item.badge && item.badge > 0 && (
              <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-border-subtle pt-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 px-2">
          <Avatar
            src={user?.avatarUrl}
            name={user?.displayName || user?.fullName || user?.username || 'You'}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.displayName || user?.fullName || 'You'}
            </p>
            {user?.username && (
              <p className="truncate text-xs text-foreground-muted">@{user.username}</p>
            )}
          </div>
        </div>
        <ThemeToggle />
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors duration-150 hover:bg-surface-muted hover:text-danger focus-visible:outline-none cursor-pointer',
          )}
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
          Logout
        </button>
      </div>
    </aside>
  )
}
