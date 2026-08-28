import { Sidebar } from '../components/Sidebar'
import Header from '../components/Header'
import { MobileNavigation } from '../components/MobileNavigation'
import { RightRail } from '../components/RightRail'
import React from 'react'

export function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-background text-foreground">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col max-w-full w-full">
        {/* Header - shown on mobile, hidden on desktop (sidebar replaces it) */}
        <Header />

        {/* pb accounts for: 56px bottom nav + env(safe-area-inset-bottom) on modern phones */}
        <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <div className="mx-auto flex w-full max-w-7xl md:justify-center gap-0 md:gap-6 px-0 sm:px-6 lg:px-8 py-0 sm:py-6">
            {/* Feed/Content Column — min-w-0 prevents flex blowout */}
            <div className="w-full md:max-w-2xl min-w-0">
              {children}
            </div>

            {/* Desktop Right Rail */}
            <RightRail />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNavigation />
    </div>
  )
}
