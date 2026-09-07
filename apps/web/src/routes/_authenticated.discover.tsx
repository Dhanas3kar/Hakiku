import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { profileApi } from '../api/profile'
import { Link } from '@tanstack/react-router'
import { Search, Loader2, Filter, X } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import { CampusPulse } from '../components/community/CampusPulse'
import { CampusInsights } from '../components/community/CampusInsights'
import { PeopleWorthKnowing } from '../components/community/PeopleWorthKnowing'
import { HotTakesFeed } from '../components/community/HotTakesFeed'
import { ConfessionFeed } from '../components/community/ConfessionFeed'

export const Route = createFileRoute('/_authenticated/discover')({
  component: DiscoverPage,
})

type Tab = 'pulse_people' | 'hot_takes' | 'confessions'

function DiscoverPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pulse_people')

  return (
    <div className="flex-1 w-full flex flex-col items-center bg-surface">
      <div
        className="w-full max-w-full md:max-w-2xl lg:max-w-3xl flex flex-col bg-surface border-x-0 sm:border-x border-border shadow-none sm:shadow-sm"
        style={{ minHeight: 'calc(100dvh - 3.5rem - env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border p-4 shrink-0">
          <h1 className="text-xl font-bold text-foreground">Discover</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Discover campus pulse, connect with people, and explore trends around SRM
          </p>

          {/* Scrollable tabs */}
          <div className="flex gap-1 mt-4 p-1 bg-surface-muted rounded-xl overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabButton
              active={activeTab === 'pulse_people'}
              onClick={() => setActiveTab('pulse_people')}
            >
              Pulse &amp; People Search
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
        <div className="flex-1 w-full">
          {activeTab === 'pulse_people' && <PulsePeopleSearchTab />}
          {activeTab === 'hot_takes' && <HotTakesTab />}
          {activeTab === 'confessions' && <ConfessionsTab />}
        </div>
      </div>
    </div>
  )
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-max px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${
        active
          ? 'bg-surface text-foreground shadow-sm ring-1 ring-border/50'
          : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted/80'
      }`}
    >
      {children}
    </button>
  )
}

function PulsePeopleSearchTab() {
  const [query, setQuery] = useState('')
  const [campus, setCampus] = useState('')
  const [department, setDepartment] = useState('')
  const [batchYear, setBatchYear] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const debouncedQuery = useDebounce(query, 400)
  const debouncedCampus = useDebounce(campus, 400)
  const debouncedDepartment = useDebounce(department, 400)
  const debouncedBatchYear = useDebounce(batchYear, 400)

  const hasSearchInput = Boolean(debouncedQuery || debouncedCampus || debouncedDepartment || debouncedBatchYear)

  const { data, isLoading } = useQuery({
    queryKey: ['profileSearch', debouncedQuery, debouncedCampus, debouncedDepartment, debouncedBatchYear],
    queryFn: () =>
      profileApi.searchProfiles({
        query: debouncedQuery || undefined,
        campus: debouncedCampus || undefined,
        department: debouncedDepartment || undefined,
        batchYear: debouncedBatchYear ? parseInt(debouncedBatchYear) : undefined,
      }),
    enabled: hasSearchInput,
  })

  const searchResults = data?.items || []

  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Search & Filter Slot */}
      <div className="flex flex-col gap-3 p-4 bg-surface-elevated border border-border rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search people by name or @username..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground p-0.5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl border border-border transition-colors cursor-pointer ${
              showFilters || campus || department || batchYear
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-surface hover:bg-surface-muted text-foreground-muted'
            }`}
            title="Toggle filters"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Collapsible Filter Inputs */}
        {showFilters && (
          <div className="grid grid-cols-3 gap-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <input
              type="text"
              placeholder="Campus"
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <input
              type="text"
              placeholder="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <input
              type="number"
              placeholder="Batch Year"
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}
      </div>

      {/* Dynamic Search Results Slot */}
      {hasSearchInput && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Search Results
            </h2>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {searchResults.map((profile) => (
                <Link
                  key={profile.userId}
                  to="/profile/$username"
                  params={{ username: profile.username }}
                  className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:border-primary/40 hover:bg-surface-muted transition-all"
                >
                  <img
                    src={profile.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.displayName}`}
                    alt={profile.displayName}
                    loading="lazy"
                    decoding="async"
                    className="h-11 w-11 rounded-full object-cover bg-surface-muted ring-2 ring-primary/20 shrink-0"
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-sm text-foreground truncate">{profile.displayName}</span>
                    <span className="text-xs text-foreground-muted truncate">@{profile.username}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-foreground-muted text-sm bg-surface-elevated border border-border rounded-xl">
              No profiles found matching your search.
            </div>
          )}
        </section>
      )}

      {/* Recommended People Section */}
      <PeopleWorthKnowing />

      {/* Campus Trends & Insights */}
      <div className="space-y-6">
        <CampusPulse />
        <CampusInsights />
      </div>
    </div>
  )
}

function HotTakesTab() {
  return (
    <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <HotTakesFeed />
    </div>
  )
}

function ConfessionsTab() {
  return (
    <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <ConfessionFeed />
    </div>
  )
}
