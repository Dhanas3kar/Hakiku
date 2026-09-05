import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, Home, Compass, MessageSquare, Bell, Settings, LogOut, Shield, ChevronRight, Sparkles, Users, Trophy } from 'lucide-react'
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

  const navItems = [
    { label: 'Home', to: '/', icon: Home },
    { label: 'Collaborate', to: '/collaborate', icon: Sparkles },
    { label: 'Communities', to: '/communities', icon: Users },
    { label: 'Hackathons', to: '/hackathons', icon: Trophy },
    { label: 'Discover', to: '/discover', icon: Compass },
    { label: 'Messages', to: '/messages', icon: MessageSquare, badge: unreadCounts.messages },
    { label: 'Notifications', to: '/notifications', icon: Bell, badge: unreadCounts.notifications },
    { label: 'Settings', to: '/settings', icon: Settings },
  ]
  if (user?.role === 'ADMIN' || user?.role === 'MODERATOR') {
    navItems.push({ label: 'Admin Panel', to: '/admin', icon: Shield })
  }

  const handleNavigate = (to: string) => {
    setIsOpen(false)
    setTimeout(() => {
      navigate({ to })
    }, 150)
  }

  const handleLogout = () => {
    setIsOpen(false)
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
    <>
      <header className="w-full md:hidden sticky top-0 z-40 border-b border-border bg-surface/90 px-4 backdrop-blur-md">
        <nav className="w-full flex items-center justify-between py-2.5">
          {/* Sidebar Menu Trigger */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center justify-center rounded-lg p-2 hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus text-foreground cursor-pointer"
            aria-label="Open sidebar menu"
          >
            <Menu className="h-6 w-6 text-foreground" />
          </button>

          {/* Brand Logo in center */}
          <Link to="/" className="inline-flex items-center text-foreground no-underline">
            <BrandLogo className="h-6" />
          </Link>

          {/* Quick Theme Toggle */}
          <ThemeToggle compact />
        </nav>
      </header>

      {/* Smooth Animated Navigation Drawer (z-[100] above mobile navigation) */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex md:hidden">
            {/* Backdrop Fade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="fixed inset-0 bg-black/65 backdrop-blur-xs"
              onClick={() => setIsOpen(false)}
            />

            {/* Slide-in Drawer Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="relative flex flex-col h-[100dvh] w-[290px] max-w-[85vw] bg-surface border-r border-border shadow-2xl z-10 overflow-hidden"
            >
              {/* Profile Card Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-surface-elevated/40 shrink-0">
                <button
                  type="button"
                  onClick={() => handleNavigate(`/profile/${user?.username || ''}`)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-85 transition-opacity cursor-pointer group"
                >
                  <Avatar
                    src={user?.avatarUrl}
                    name={user?.displayName || user?.fullName || user?.username || 'You'}
                    size="md"
                    className="border border-border shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {user?.displayName || user?.fullName || 'You'}
                    </p>
                    {user?.username && (
                      <p className="truncate text-xs text-foreground-muted">@{user.username}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-foreground-muted shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-2 text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer shrink-0 ml-2"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation Items (Middle Section) */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0 [scrollbar-width:thin]">
                {navItems.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => handleNavigate(item.to)}
                    className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-base font-medium text-foreground-muted hover:bg-surface-muted hover:text-foreground transition-all duration-150 text-left group cursor-pointer"
                  >
                    <item.icon className="h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110 text-foreground-muted group-hover:text-foreground" strokeWidth={2} />
                    <span className="flex-1 font-semibold">{item.label}</span>
                    {!!item.badge && item.badge > 0 && (
                      <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              {/* Fixed Footer with Always-Visible Logout Button & Safe Padding */}
              <div className="shrink-0 p-4 pb-6 border-t border-border bg-surface-elevated/50 space-y-3">
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm font-medium text-foreground-muted">Appearance</span>
                  <ThemeToggle compact />
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger hover:bg-danger hover:text-white transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <LogOut className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
