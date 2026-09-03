import { Link, useLocation } from '@tanstack/react-router'
import { Sidebar } from '../components/Sidebar'
import Header from '../components/Header'
import { MobileNavigation } from '../components/MobileNavigation'
import { RightRail } from '../components/RightRail'
import React from 'react'
import { cn } from '../lib/cn'

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const path = location.pathname
  const isMessages = path.startsWith('/messages')
  const isAdmin = path.startsWith('/admin')
  const isDiscover = path.startsWith('/discover')
  const isOnboarding = path.startsWith('/onboarding')
  const isSettings = path.startsWith('/settings')
  const hideRail = isMessages || isDiscover || isOnboarding || isSettings || isAdmin
  const fullBleed = isMessages || isAdmin || isDiscover

  if (isAdmin) {
    return (
      <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-background text-foreground">
        {children}
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col max-w-full w-full">
        <Header />

        <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <div
            className={cn(
              'mx-auto flex w-full gap-0',
              fullBleed
                ? 'max-w-none px-0 py-0 md:pl-0'
                : 'max-w-6xl md:justify-center md:gap-8 px-0 sm:px-6 lg:px-8 py-0 sm:py-8',
            )}
          >
            <div
              className={cn(
                'min-w-0 w-full',
                fullBleed ? 'max-w-none' : 'md:max-w-2xl',
              )}
            >
              {children}
            </div>
            {!hideRail && <RightRail />}
          </div>
        </main>
      </div>

      <MobileNavigation />
    </div>
  )
}
