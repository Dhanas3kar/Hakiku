import { useState } from 'react';
import { type Community, type CommunityMember } from '../../api/communities';
import { X, Settings, Hash, Users, Shield, Trash2, Crown, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CommunitySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  community: Community;
  members?: CommunityMember[];
  onCreateChannel?: (name: string, description?: string) => void;
  onDeleteCommunity?: () => void;
}

export function CommunitySettingsModal({
  isOpen,
  onClose,
  community,
  members = [],
  onCreateChannel,
  onDeleteCommunity,
}: CommunitySettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'members' | 'danger'>('overview');
  const [newChanName, setNewChanName] = useState('');

  if (!isOpen) return null;

  const handleChannelCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName.trim() || !onCreateChannel) return;
    onCreateChannel(newChanName.trim().toLowerCase().replace(/\s+/g, '-'));
    setNewChanName('');
    toast.success(`Channel #${newChanName} created`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-xl rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5 bg-surface-elevated/30">
          <div className="flex items-center gap-2.5">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Community Settings</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-border/80 bg-surface-muted/40 px-5 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'channels'
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}
          >
            <Hash className="h-3.5 w-3.5" /> Channels ({community.channels?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'members'
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Members ({members.length || community.memberCount || 1})
          </button>
          {community.userRole === 'OWNER' && (
            <button
              onClick={() => setActiveTab('danger')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'danger'
                  ? 'border-rose-500 text-rose-500'
                  : 'border-transparent text-foreground-muted hover:text-rose-500'
              }`}
            >
              Danger Zone
            </button>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/80 bg-surface-muted/30 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Community Details</h4>
                <div className="space-y-1">
                  <div className="text-base font-extrabold text-foreground">{community.name}</div>
                  <div className="text-xs text-foreground-muted">{community.description || 'No description provided.'}</div>
                </div>

                <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-bold text-foreground-muted">
                  <span className="rounded-md bg-surface px-2.5 py-1 border border-border">
                    Category: {community.category}
                  </span>
                  <span className="rounded-md bg-surface px-2.5 py-1 border border-border">
                    Visibility: {community.visibility}
                  </span>
                  <span className="rounded-md bg-surface px-2.5 py-1 border border-border">
                    Slug: /{community.slug || community.id}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHANNELS */}
          {activeTab === 'channels' && (
            <div className="space-y-5">
              {onCreateChannel && (
                <form onSubmit={handleChannelCreate} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="New channel name (e.g. projects)..."
                    value={newChanName}
                    onChange={(e) => setNewChanName(e.target.value)}
                    className="flex-1 rounded-2xl border border-border bg-surface-muted/60 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-muted/60 focus:border-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {community.channels?.map((chan) => (
                  <div
                    key={chan.id}
                    className="flex items-center justify-between rounded-2xl border border-border/70 bg-surface-muted/30 p-3 text-xs font-semibold text-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-primary" />
                      <span>{chan.name}</span>
                    </div>

                    <span className="text-[10px] text-foreground-muted uppercase tracking-wider">
                      Text Channel
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              {members.map((mem) => (
                <div
                  key={mem.id || mem.userId}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-surface-muted/30 p-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                      {mem.profile?.fullName?.substring(0, 2).toUpperCase() || 'SM'}
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{mem.profile?.fullName || 'Student Member'}</div>
                      <div className="text-[10px] text-foreground-muted">{mem.profile?.department || 'Student'}</div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                    {mem.role === 'OWNER' && <Crown className="h-3 w-3 text-amber-500" />}
                    {mem.role}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: DANGER ZONE */}
          {activeTab === 'danger' && community.userRole === 'OWNER' && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 space-y-3">
              <h4 className="text-sm font-bold text-rose-500 flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Delete Community
              </h4>
              <p className="text-xs text-foreground-muted leading-relaxed">
                Permanently remove this community, all text channels, and message archives. This action cannot be undone.
              </p>
              {onDeleteCommunity && (
                <button
                  type="button"
                  onClick={onDeleteCommunity}
                  className="rounded-2xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rose-700 transition-colors"
                >
                  Delete Community Permanently
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
