import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { profileApi } from '../api/profile'
import { Link } from '@tanstack/react-router'
import { Search, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/discover')({
  component: DiscoverPage,
})

type Tab = 'pulse_people' | 'hot_takes' | 'confessions' | 'search'

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
            <TabButton 
              active={activeTab === 'search'} 
              onClick={() => setActiveTab('search')}
            >
              Search
            </TabButton>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto w-full relative scroll-smooth">
          {activeTab === 'pulse_people' && <PulseAndPeopleTab />}
          {activeTab === 'hot_takes' && <HotTakesTab />}
          {activeTab === 'confessions' && <ConfessionsTab />}
          {activeTab === 'search' && <SearchTab />}
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


import { useDebounce } from '../hooks/useDebounce'

function SearchTab() {
  const [query, setQuery] = useState('')
  const [campus, setCampus] = useState('')
  const [department, setDepartment] = useState('')
  const [batchYear, setBatchYear] = useState('')

  const debouncedQuery = useDebounce(query, 500)
  const debouncedCampus = useDebounce(campus, 500)
  const debouncedDepartment = useDebounce(department, 500)
  const debouncedBatchYear = useDebounce(batchYear, 500)

  const { data, isLoading } = useQuery({
    queryKey: ['profileSearch', debouncedQuery, debouncedCampus, debouncedDepartment, debouncedBatchYear],
    queryFn: () => profileApi.searchProfiles({ 
      query: debouncedQuery || undefined, 
      campus: debouncedCampus || undefined, 
      department: debouncedDepartment || undefined, 
      batchYear: debouncedBatchYear ? parseInt(debouncedBatchYear) : undefined 
    }),
  })

  const results = data?.items || []

  return (
    <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-6">
      <div className="flex flex-col gap-4 p-4 bg-surface-elevated border border-border rounded-xl shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search by name or username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Campus"
            value={campus}
            onChange={(e) => setCampus(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            type="text"
            placeholder="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            type="number"
            placeholder="Batch Year"
            value={batchYear}
            onChange={(e) => setBatchYear(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : results.length > 0 ? (
          results.map((profile) => (
            <Link
              key={profile.userId}
              to="/profile/$username"
              params={{ username: profile.username }}
              className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:bg-surface-muted transition-colors"
            >
              <img
                src={profile.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.displayName}`}
                alt={profile.displayName}
                loading="lazy"
                decoding="async"
                className="h-12 w-12 rounded-full object-cover bg-surface-muted"
              />
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{profile.displayName}</span>
                <span className="text-sm text-foreground-muted">@{profile.username}</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-12 text-foreground-muted text-sm">
            No profiles found. Try adjusting your search criteria.
          </div>
        )}
      </div>
    </div>
  )
}
