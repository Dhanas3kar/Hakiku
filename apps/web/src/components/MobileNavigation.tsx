import { Link } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'
import { Home, Compass, MessageSquare, Bell, User } from 'lucide-react'
import { useUnreadCounts } from '../hooks/useUnreadCounts'

export function MobileNavigation() {
  const { user } = useAuth()
  const unreadCounts = useUnreadCounts()
  const navItems = [
    { label: 'Home', to: '/', icon: Home, badge: 0 },
    { label: 'Discover', to: '/discover', icon: Compass, badge: 0 },
    { label: 'Messages', to: '/messages', icon: MessageSquare, badge: unreadCounts.messages },
    { label: 'Alerts', to: '/notifications', icon: Bell, badge: unreadCounts.notifications },
    { label: 'Profile', to: `/profile/${user?.username || ''}`, icon: User, badge: 0 },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center justify-around px-2">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-md p-2 text-foreground-muted transition-colors duration-150 hover:text-foreground"
            activeProps={{ className: 'text-foreground' }}
          >
            <item.icon className="h-5 w-5" strokeWidth={1.75} />
            <span className="sr-only">{item.label}</span>
            {item.badge > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold text-primary-foreground">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  )
}
