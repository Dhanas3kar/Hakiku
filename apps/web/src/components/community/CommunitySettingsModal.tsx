import { useState } from 'react';
import { type Community, type CommunityMember } from '../../api/communities';
import {
  X,
  Settings,
  Hash,
  Users,
  Trash2,
  Crown,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

interface CommunitySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  community: Community;
  members?: CommunityMember[];
  onCreateChannel?: (name: string, description?: string) => void;
  onDeleteCommunity?: () => void;
}

type SettingsTab = 'overview' | 'channels' | 'members' | 'danger';

export function CommunitySettingsModal({
  isOpen,
  onClose,
  community,
  members = [],
  onCreateChannel,
  onDeleteCommunity,
}: CommunitySettingsModalProps) {
  const [activeTab, setActiveTab] =
    useState<SettingsTab>('overview');

  const [newChanName, setNewChanName] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  if (!isOpen) return null;

  const isOwner = community.userRole === 'OWNER';

  const channelCount = community.channels?.length ?? 0;
  const memberCount =
    members.length > 0
      ? members.length
      : community.memberCount ?? 1;

  const tabs: Array<{
    id: SettingsTab;
    label: string;
    icon?: typeof Hash;
    count?: number;
    ownerOnly?: boolean;
  }> = [
      {
        id: 'overview',
        label: 'Overview',
      },
      {
        id: 'channels',
        label: 'Channels',
        icon: Hash,
        count: channelCount,
      },
      {
        id: 'members',
        label: 'Members',
        icon: Users,
        count: memberCount,
      },
      {
        id: 'danger',
        label: 'Danger Zone',
        ownerOnly: true,
      },
    ];

  const normalizeChannelName = (value: string) => {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  };

  const handleChannelCreate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!onCreateChannel || isCreatingChannel) {
      return;
    }

    const normalizedName = normalizeChannelName(newChanName);

    if (!normalizedName) {
      toast.error('Enter a valid channel name.');
      return;
    }

    if (community.channels?.some(
      (channel) =>
        channel.name.toLowerCase() === normalizedName,
    )) {
      toast.error(`Channel #${normalizedName} already exists.`);
      return;
    }

    try {
      setIsCreatingChannel(true);

      await onCreateChannel(normalizedName);

      setNewChanName('');
      toast.success(`Channel #${normalizedName} created.`);
    } catch {
      toast.error('Failed to create channel.');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleClose = () => {
    if (isCreatingChannel) return;

    setNewChanName('');
    setActiveTab('overview');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-settings-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close settings"
        onClick={handleClose}
        disabled={isCreatingChannel}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 disabled:cursor-default"
      />

      {/* Modal */}
      <div className="relative z-10 flex w-full max-w-xl max-h-[92vh] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-elevated/30 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Settings className="h-4 w-4 text-primary" />
            </div>

            <div className="min-w-0">
              <h2
                id="community-settings-title"
                className="truncate text-base sm:text-lg font-bold text-foreground"
              >
                Community Settings
              </h2>

              <p className="truncate text-[10px] text-foreground-muted">
                {community.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isCreatingChannel}
            aria-label="Close settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 overflow-x-auto border-b border-border/80 bg-surface-muted/40">
          <div className="flex min-w-max px-3 sm:px-5">
            {tabs
              .filter((tab) => !tab.ownerOnly || isOwner)
              .map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-1.5 border-b-2 px-3 py-3 text-[11px] font-bold transition-colors sm:px-4 ${isActive
                        ? tab.id === 'danger'
                          ? 'border-rose-500 text-rose-500'
                          : 'border-primary text-primary'
                        : 'border-transparent text-foreground-muted hover:text-foreground'
                      }`}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}

                    <span>{tab.label}</span>

                    {typeof tab.count === 'number' && (
                      <span className="rounded-full bg-surface px-1.5 py-0.5 text-[9px] text-foreground-muted">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-border/80 bg-surface-muted/30 p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                  Community Details
                </h3>

                <div className="mt-3 space-y-1">
                  <h4 className="text-base font-extrabold text-foreground">
                    {community.name}
                  </h4>

                  <p className="text-xs leading-relaxed text-foreground-muted">
                    {community.description ||
                      'No description provided.'}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[10px] font-bold text-foreground-muted">
                    Category: {community.category}
                  </span>

                  <span className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[10px] font-bold text-foreground-muted">
                    Visibility: {community.visibility}
                  </span>

                  <span className="max-w-full truncate rounded-lg border border-border bg-surface px-2.5 py-1 text-[10px] font-bold text-foreground-muted">
                    Slug: /{community.slug || community.id}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/70 bg-surface-muted/30 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                    Members
                  </span>

                  <div className="mt-1 text-lg font-extrabold text-foreground">
                    {memberCount.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-surface-muted/30 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                    Channels
                  </span>

                  <div className="mt-1 text-lg font-extrabold text-foreground">
                    {channelCount.toLocaleString()}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* CHANNELS */}
          {activeTab === 'channels' && (
            <section className="space-y-5">
              {onCreateChannel && (
                <form
                  onSubmit={handleChannelCreate}
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={newChanName}
                    onChange={(event) =>
                      setNewChanName(event.target.value)
                    }
                    placeholder="Channel name"
                    disabled={isCreatingChannel}
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-2xl border border-border bg-surface-muted/60 px-4 py-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-foreground-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
                  />

                  <button
                    type="submit"
                    disabled={
                      isCreatingChannel ||
                      !newChanName.trim()
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />

                    {isCreatingChannel
                      ? 'Creating...'
                      : 'Add'}
                  </button>
                </form>
              )}

              {channelCount > 0 ? (
                <div className="space-y-2">
                  {community.channels?.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface-muted/30 p-3 transition-colors hover:bg-surface-muted/50"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Hash className="h-4 w-4 shrink-0 text-primary" />

                        <span className="truncate text-xs font-semibold text-foreground">
                          {channel.name}
                        </span>
                      </div>

                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-foreground-muted">
                        Text
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                  <Hash className="mx-auto h-7 w-7 text-foreground-muted/50" />

                  <p className="mt-2 text-xs font-semibold text-foreground-muted">
                    No channels yet
                  </p>

                  <p className="mt-1 text-[10px] text-foreground-muted/70">
                    Create the first channel for this community.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* MEMBERS */}
          {activeTab === 'members' && (
            <section className="space-y-2">
              {members.length > 0 ? (
                members.map((member) => {
                  const name =
                    member.profile?.fullName ||
                    'Student Member';

                  const initials =
                    name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((word) => word.charAt(0))
                      .join('')
                      .toUpperCase() || 'SM';

                  return (
                    <div
                      key={member.id || member.userId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface-muted/30 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[10px] font-bold text-primary"
                          aria-hidden="true"
                        >
                          {initials}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-foreground">
                            {name}
                          </div>

                          <div className="truncate text-[10px] text-foreground-muted">
                            {member.profile?.department ||
                              'Student'}
                          </div>
                        </div>
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">
                        {member.role === 'OWNER' && (
                          <Crown className="h-3 w-3 text-amber-500" />
                        )}

                        {member.role}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                  <Users className="mx-auto h-7 w-7 text-foreground-muted/50" />

                  <p className="mt-2 text-xs font-semibold text-foreground-muted">
                    No member data available
                  </p>
                </div>
              )}
            </section>
          )}

          {/* DANGER */}
          {activeTab === 'danger' && isOwner && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-rose-500" />

                  <h3 className="text-sm font-bold text-rose-500">
                    Delete Community
                  </h3>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                  Permanently remove this community, its
                  channels, memberships, and associated content.
                  This action cannot be undone.
                </p>

                {onDeleteCommunity && (
                  <button
                    type="button"
                    onClick={onDeleteCommunity}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Community Permanently
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}