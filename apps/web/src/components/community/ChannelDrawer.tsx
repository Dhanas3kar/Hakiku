import { type Community } from '../../api/communities';
import { Hash, X, Plus, Lock, Check } from 'lucide-react';

interface ChannelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  community: Community;
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onAddChannel?: () => void;
}

export function ChannelDrawer({
  isOpen,
  onClose,
  community,
  activeChannelId,
  onSelectChannel,
  onAddChannel,
}: ChannelDrawerProps) {
  if (!isOpen) return null;

  const isOwnerOrMod = community.userRole === 'OWNER' || community.userRole === 'MODERATOR';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 md:hidden">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-h-[80vh] rounded-t-3xl border-t border-border bg-surface p-5 shadow-2xl flex flex-col space-y-4 animate-in slide-in-from-bottom duration-250">
        {/* Handle Bar */}
        <div className="mx-auto h-1.5 w-12 rounded-full bg-border-subtle shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground">{community.name}</h3>
            <span className="text-xs text-foreground-muted font-medium">Text Channels ({community.channels?.length || 0})</span>
          </div>

          <div className="flex items-center gap-2">
            {isOwnerOrMod && onAddChannel && (
              <button
                onClick={() => {
                  onClose();
                  onAddChannel();
                }}
                className="flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary border border-primary/20"
              >
                <Plus className="h-3.5 w-3.5" /> Channel
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-full p-2 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Channel List Options */}
        <div className="overflow-y-auto max-h-[55vh] space-y-1.5 py-1">
          {community.channels?.map((channel) => {
            const isActive = channel.id === activeChannelId;
            return (
              <button
                key={channel.id}
                onClick={() => {
                  onSelectChannel(channel.id);
                  onClose();
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'bg-surface-muted/60 text-foreground hover:bg-surface-muted'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Hash className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-primary'}`} />
                  <span className="truncate">{channel.name}</span>
                  {channel.isPrivate && <Lock className="h-3.5 w-3.5 text-warning shrink-0" />}
                </div>

                {isActive && <Check className="h-4 w-4 shrink-0 text-primary-foreground" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
