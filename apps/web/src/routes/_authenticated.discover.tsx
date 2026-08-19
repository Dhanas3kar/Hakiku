import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/discover')({
  component: DiscoverPage,
})

type Tab = 'pulse_people' | 'hot_takes' | 'confessions'

function DiscoverPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pulse_people')

  return (
    <div className="flex-1 w-full flex flex-col items-center bg-surface pb-20 md:pb-0 h-[100dvh] overflow-hidden">
      <div className="w-full max-w-2xl flex flex-col h-full bg-surface border-x border-border shadow-sm">
        
        {/* Header */}
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border p-4 shrink-0">
          <h1 className="text-xl font-bold text-foreground">Discover</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Discover what's happening around SRM
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 p-1 bg-surface-muted rounded-xl overflow-x-auto scrollbar-hide">
            <TabButton 
              active={activeTab === 'pulse_people'} 
              onClick={() => setActiveTab('pulse_people')}
            >
              Pulse & People
            </TabButton>
            <TabButton 
              active={activeTab === 'hot_takes'} 
              onClick={() => setActiveTab('hot_takes')}
            >
              Hot Takes
            </TabButton>
            <TabButton 
              active={activeTab === 'confessions'} 
              onClick={() => setActiveTab('confessions')}
            >
              Confessions
            </TabButton>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto w-full relative scroll-smooth">
          {activeTab === 'pulse_people' && <PulseAndPeopleTab />}
          {activeTab === 'hot_takes' && <HotTakesTab />}
          {activeTab === 'confessions' && <ConfessionsTab />}
        </div>

      </div>
    </div>
  )
}

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-max px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
        active 
          ? 'bg-surface text-foreground shadow-sm ring-1 ring-border/50' 
          : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted/80'
      }`}
    >
      {children}
    </button>
  )
}

import { CampusPulse } from '../components/community/CampusPulse'
import { CampusInsights } from '../components/community/CampusInsights'
import { PeopleWorthKnowing } from '../components/community/PeopleWorthKnowing'

function PulseAndPeopleTab() {
  return (
    <div className="p-4 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CampusPulse />
      <CampusInsights />
      <PeopleWorthKnowing />
    </div>
  )
}

import { PollFeed } from '../components/community/PollFeed'

function HotTakesTab() {
  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PollFeed />
    </div>
  )
}

import { ConfessionFeed } from '../components/community/ConfessionFeed'

function ConfessionsTab() {
  return (
    <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <ConfessionFeed />
    </div>
  )
}
