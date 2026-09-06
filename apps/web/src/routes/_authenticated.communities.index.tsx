import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communitiesApi, type Community } from '../api/communities';
import { CreateCommunityModal } from '../components/community/CreateCommunityModal';
import {
  Users,
  Plus,
  Search,
  Lock,
  Globe,
  Sparkles,
  UserCheck,
  Compass,
  X,
  ArrowRight,
  MessageCircle,
  Building2,
  Bot,
  Laptop,
  Rocket,
  Gamepad2,
  Trophy,
  Palette,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/communities/')({
  component: CommunitiesDiscoveryPage,
});

const CATEGORIES = [
  { name: 'All', icon: Compass },
  { name: 'Tech', icon: Laptop },
  { name: 'Departments', icon: Building2 },
  { name: 'AI/ML', icon: Bot },
  { name: 'Design', icon: Palette },
  { name: 'Culture', icon: Sparkles },
  { name: 'Projects', icon: Layers },
  { name: 'Other', icon: MessageCircle },
];

function CommunitiesDiscoveryPage() {
  const [activeTab, setActiveTab] = useState<'discover' | 'my'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: discoverData, isLoading: isDiscoverLoading } = useQuery({
    queryKey: ['communities', 'discover', searchQuery, categoryFilter],
    queryFn: () => communitiesApi.getCommunities({ search: searchQuery, category: categoryFilter }),
    enabled: activeTab === 'discover',
  });

  const { data: myCommunities, isLoading: isMyLoading } = useQuery({
    queryKey: ['communities', 'my'],
    queryFn: () => communitiesApi.getMyCommunities(),
    enabled: activeTab === 'my',
  });

  const createMutation = useMutation({
    mutationFn: (dto: { name: string; description?: string; category?: string; visibility?: string }) =>
      communitiesApi.createCommunity(dto),
    onSuccess: () => {
      toast.success('Community created successfully!');
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create community');
    },
  });

  const joinMutation = useMutation({
    mutationFn: (communityId: string) => communitiesApi.joinCommunity(communityId),
    onSuccess: () => {
      toast.success('Joined community!');
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to join community');
    },
  });

  const totalMyCount = myCommunities?.length || 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8 space-y-8">
        {/* EDITORIAL HERO SECTION */}
        <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 md:flex-row md:items-end">
          <div className="space-y-3 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              COMMUNITIES
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-foreground leading-tight">
              Find the people building <br className="hidden sm:inline" />
              things that matter.
            </h1>
            <p className="text-sm sm:text-base text-foreground-muted leading-relaxed">
              Discover student-led communities, clubs, departments and interest groups across campus.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Create Community</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION CONTROLS: TABS & SEARCH */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Segment Tabs */}
          <div className="inline-flex rounded-2xl border border-border/80 bg-surface/90 p-1.5 shadow-xs">
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all duration-150 ${
                activeTab === 'discover'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted/60'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              Discover
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all duration-150 ${
                activeTab === 'my'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted/60'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Joined</span>
              {totalMyCount > 0 && (
                <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  activeTab === 'my' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                }`}>
                  {totalMyCount}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          {activeTab === 'discover' && (
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
              <input
                type="text"
                placeholder="Search communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-border bg-surface pl-11 pr-9 py-2.5 text-xs text-foreground placeholder:text-foreground-muted/60 shadow-xs transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* CATEGORY PILL FILTERS */}
        {activeTab === 'discover' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = cat.name === 'All' ? !categoryFilter : categoryFilter === cat.name;
              const IconComponent = cat.icon;
              return (
                <button
                  key={cat.name}
                  onClick={() => setCategoryFilter(cat.name === 'All' ? '' : cat.name)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border/80 bg-surface/80 text-foreground-muted hover:border-primary/40 hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <IconComponent className="h-3.5 w-3.5" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* DISCOVER COMMUNITY LIST (1 COL MOBILE, 2 COL TABLET, 3 COL DESKTOP) */}
        {activeTab === 'discover' && (
          <>
            {isDiscoverLoading ? (
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-48 rounded-3xl border border-border bg-surface-muted/40 p-5 animate-pulse space-y-4"
                  />
                ))}
              </div>
            ) : discoverData?.items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-10 text-center space-y-4 max-w-md mx-auto">
                <Users className="mx-auto h-10 w-10 text-foreground-muted" />
                <div>
                  <h3 className="text-base font-bold text-foreground">No communities found</h3>
                  <p className="mt-1 text-xs text-foreground-muted leading-relaxed">
                    Be the first student to launch a community here.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
                >
                  <Plus className="h-4 w-4" /> Create Community
                </button>
              </div>
            ) : (
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {discoverData?.items.map((comm) => (
                  <CommunityCardItem
                    key={comm.id}
                    community={comm}
                    onJoin={() => joinMutation.mutate(comm.id)}
                    isJoining={joinMutation.isPending}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* JOINED COMMUNITIES LIST */}
        {activeTab === 'my' && (
          <>
            {isMyLoading ? (
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-48 rounded-3xl border border-border bg-surface-muted/40 p-5 animate-pulse space-y-4"
                  />
                ))}
              </div>
            ) : myCommunities?.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-10 text-center space-y-4 max-w-md mx-auto">
                <UserCheck className="mx-auto h-10 w-10 text-foreground-muted" />
                <div>
                  <h3 className="text-base font-bold text-foreground">You haven't joined any communities yet</h3>
                  <p className="mt-1 text-xs text-foreground-muted leading-relaxed">
                    Explore campus communities and join your peers.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('discover')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
                >
                  Browse Communities
                </button>
              </div>
            ) : (
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {myCommunities?.map((comm) => (
                  <CommunityCardItem key={comm.id} community={comm} />
                ))}
              </div>
            )}
          </>
        )}

        {/* CREATE COMMUNITY MODAL */}
        <CreateCommunityModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={(dto) => createMutation.mutate(dto)}
          isPending={createMutation.isPending}
        />
      </div>
    </div>
  );
}

function CommunityCardItem({
  community,
  onJoin,
  isJoining,
}: {
  community: Community;
  onJoin?: () => void;
  isJoining?: boolean;
}) {
  const initials = community.name.substring(0, 2).toUpperCase();

  return (
    <div className="group relative flex flex-col justify-between rounded-3xl border border-border/80 bg-surface p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 font-extrabold text-sm text-white shadow-xs">
              {initials}
            </div>

            <div className="min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                {community.name}
              </h3>
              <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider block truncate">
                {community.category}
              </span>
            </div>
          </div>

          {community.visibility === 'PRIVATE' ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning border border-warning/20 shrink-0">
              <Lock className="h-3 w-3" /> Private
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <Globe className="h-3 w-3" /> Public
            </span>
          )}
        </div>

        <p className="mt-3 text-xs text-foreground-muted line-clamp-2 leading-relaxed">
          {community.description || 'Campus student community for discussion, project collaboration, and learning.'}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border-subtle pt-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground-muted">
          <Users className="h-3.5 w-3.5" />
          {community.memberCount || 1} members
        </span>

        {community.isMember ? (
          <Link
            to="/communities/$communityId"
            params={{ communityId: community.slug || community.id }}
            className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <span>Enter Community</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <button
            onClick={onJoin}
            disabled={isJoining || community.visibility === 'PRIVATE'}
            className="inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-xs transition-transform active:scale-95 disabled:opacity-50"
          >
            {isJoining ? 'Joining...' : 'Join'}
          </button>
        )}
      </div>
    </div>
  );
}
