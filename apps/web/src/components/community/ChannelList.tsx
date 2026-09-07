import { type Community } from '../../api/communities';
import { Hash, Plus, Users, Crown, Lock } from 'lucide-react';

interface ChannelListProps {
  community: Community;
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onAddChannel?: () => void;
}

export function ChannelList({
  community,
  activeChannelId,
  onSelectChannel,
  onAddChannel,
}: ChannelListProps) {
  const isOwnerOrMod = community.userRole === 'OWNER' || community.userRole === 'MODERATOR';

  return (
    <div className="flex flex-col h-full bg-surface/90 border-r border-border/80 w-60 shrink-0 select-none">
      {/* Header Info Banner */}
      <div className="flex h-14 items-center justify-between border-b border-border/80 px-4 bg-surface-elevated/30">
        <div className="truncate min-w-0">
          <h2 className="font-bold text-xs uppercase tracking-wider text-foreground-muted truncate">
            {community.name}
          </h2>
          <span className="text-[10px] font-semibold text-primary truncate block">
            {community.memberCount || 1} members
          </span>
        </div>

        {isOwnerOrMod && onAddChannel && (
          <button
            onClick={onAddChannel}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-muted hover:text-foreground transition-colors"
            title="Create Channel"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Channel Categories & Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-foreground-muted">
            <span>Text Channels</span>
            <span className="text-xs font-semibold text-foreground-muted/70">
              {community.channels?.length || 0}
            </span>
          </div>

          <div className="space-y-0.5">
            {community.channels?.map((channel) => {
              const isActive = channel.id === activeChannelId;
              return (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel.id)}
                  className={`group relative flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-foreground-muted hover:bg-surface-muted/80 hover:text-foreground'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary" />
                  )}
                  <Hash
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-primary' : 'text-foreground-muted group-hover:text-foreground'
                    }`}
                  />
                  <span className="truncate flex-1 text-left">{channel.name}</span>
                  {channel.isPrivate && <Lock className="h-3 w-3 shrink-0 text-warning" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Role Footer */}
      <div className="border-t border-border/80 p-3 bg-surface-muted/30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-foreground-muted text-xs">
          <Users className="h-3.5 w-3.5" />
          <span>Members</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
          {community.userRole === 'OWNER' && <Crown className="h-3 w-3 text-amber-500" />}
          {community.userRole || 'MEMBER'}
        </span>
      </div>
    </div>
  );
}
