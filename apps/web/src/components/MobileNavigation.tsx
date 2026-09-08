import { Link, useLocation } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'
import { Home, Compass, MessageSquare, Bell, User } from 'lucide-react'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { useQueryClient } from '@tanstack/react-query'

export function MobileNavigation() {
  const { user } = useAuth()
  const unreadCounts = useUnreadCounts()
  const location = useLocation()
  const queryClient = useQueryClient()

  const handleHomeClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
      // Reset the feed to clear all pages and start fresh from page 1
      queryClient.resetQueries({ queryKey: ['feed'] })
    }
  }

  const navItems = [
    { label: 'Home', to: '/', icon: Home, badge: 0, onClick: handleHomeClick },
    { label: 'Discover', to: '/discover', icon: Compass, badge: 0 },
    { label: 'Messages', to: '/messages', icon: MessageSquare, badge: unreadCounts.messages },
    { label: 'Notifications', to: '/notifications', icon: Bell, badge: unreadCounts.notifications },
    { label: 'Profile', to: `/profile/${user?.username || ''}`, icon: User, badge: 0 },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <div className="flex h-14 max-w-lg mx-auto items-center justify-around px-2">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-label={item.label}
            onClick={item.onClick}
            className="relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg p-2 text-foreground-muted transition-all duration-150 hover:text-foreground"
            activeProps={{ className: 'text-primary font-semibold' }}
          >
            <item.icon className="h-5 w-5" strokeWidth={2} />
            <span className="sr-only">{item.label}</span>
            {item.badge > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground shadow-xs">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  )
}
