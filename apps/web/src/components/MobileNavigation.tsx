import { Link } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'
import { Home, Compass, MessageSquare, Bell, User } from 'lucide-react'
import { useUnreadCounts } from '../hooks/useUnreadCounts'

export function MobileNavigation() {
  const { user } = useAuth()
  const unreadCounts = useUnreadCounts()
  const navItems = [
    { label: 'Home', to: '/', icon: Home },
    { label: 'Discover', to: '/discover', icon: Compass },
    { label: 'Messages', to: '/messages', icon: MessageSquare },
    { label: 'Alerts', to: '/notifications', icon: Bell },
    { label: 'Profile', to: `/profile/${user?.username || ''}`, icon: User },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(0,0,0,0.05)] dark:shadow-none md:hidden">
      <div className="flex h-14 items-center justify-around px-2">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="relative flex flex-col items-center justify-center gap-1 p-2 text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-md"
            activeProps={{ className: 'text-primary' }}
          >
            <item.icon className="h-6 w-6" />
            <span className="sr-only">{item.label}</span>
            {item.label === 'Alerts' && unreadCounts.notifications > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground border-2 border-surface">
                {unreadCounts.notifications > 99 ? '99+' : unreadCounts.notifications}
              </span>
            )}
            {item.label === 'Messages' && unreadCounts.messages > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground border-2 border-surface">
                {unreadCounts.messages > 99 ? '99+' : unreadCounts.messages}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  )
}
