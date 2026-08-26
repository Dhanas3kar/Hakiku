import { Link } from '@tanstack/react-router'
import { Home, Compass, MessageSquare, Bell, User, Settings, LogOut, Shield } from 'lucide-react'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { useAuth } from '../hooks/useAuth'

export function Sidebar() {
  const { logout, user } = useAuth()
  const unreadCounts = useUnreadCounts()
  const navItems = [
    { label: 'Home', to: '/', icon: Home },
    { label: 'Discover', to: '/discover', icon: Compass },
    { label: 'Messages', to: '/messages', icon: MessageSquare },
    { label: 'Notifications', to: '/notifications', icon: Bell },
    { label: 'Profile', to: `/profile/${user?.username || ''}`, icon: User },
    { label: 'Settings', to: '/settings', icon: Settings },
  ]
  if (user?.role === 'ADMIN') {
    navItems.push({ label: 'Admin', to: '/admin', icon: Shield })
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border dark:border-transparent bg-surface px-4 py-6 md:flex h-[100dvh] sticky top-0 overflow-y-auto">
      <Link to="/" className="mb-8 flex items-center gap-2 px-2 text-foreground no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm">
        <img src="/Dark_theme_logo.png" alt="HAKIKU" className="h-8 w-auto hidden dark:block" />
        <img src="/light_theme_logo.png" alt="HAKIKU" className="h-8 w-auto block dark:hidden" />
        <span className="sr-only">HAKIKU</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus relative"
            activeProps={{ className: 'bg-surface-muted text-primary font-semibold', 'aria-current': 'page' }}
          >
            <item.icon className="h-5 w-5" />
            <span className="flex-1">{item.label}</span>
            {item.label === 'Notifications' && unreadCounts.notifications > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {unreadCounts.notifications > 99 ? '99+' : unreadCounts.notifications}
              </span>
            )}
            {item.label === 'Messages' && unreadCounts.messages > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {unreadCounts.messages > 99 ? '99+' : unreadCounts.messages}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-border pt-4">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Are you sure you want to log out?')) {
              logout()
            }
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  )
}
