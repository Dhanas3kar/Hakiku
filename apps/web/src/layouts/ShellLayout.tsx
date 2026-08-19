import { Sidebar } from '../components/Sidebar'
import Header from '../components/Header'
import { MobileNavigation } from '../components/MobileNavigation'
import { RightRail } from '../components/RightRail'
import React from 'react'

export function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] w-full bg-background text-foreground">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header - shown on mobile, and optionally on desktop */}
        <Header />

        <main className="flex-1 pb-16 md:pb-0">
          <div className="mx-auto flex w-full max-w-7xl justify-center gap-6 px-0 sm:px-6 lg:px-8 py-0 sm:py-6">
            {/* Feed/Content Column */}
            <div className="w-full max-w-2xl min-w-0">
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
