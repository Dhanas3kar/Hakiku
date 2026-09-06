import { type Community } from '../../api/communities';
import { X, Globe, Lock, Users, Hash, Settings, LogOut, Shield, Crown } from 'lucide-react';

interface CommunityInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  community: Community;
  onOpenSettings?: () => void;
  onLeaveCommunity?: () => void;
}

export function CommunityInfoSheet({
  isOpen,
  onClose,
  community,
  onOpenSettings,
  onLeaveCommunity,
}: CommunityInfoSheetProps) {
  if (!isOpen) return null;

  const initials = community.name.substring(0, 2).toUpperCase();
  const isOwnerOrMod = community.userRole === 'OWNER' || community.userRole === 'MODERATOR';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Community Header Card */}
        <div className="flex items-center gap-4 border-b border-border pb-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-lg font-black text-white shadow-md">
            {initials}
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <h2 className="text-lg font-bold text-foreground truncate">{community.name}</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-foreground-muted uppercase tracking-wider">
                {community.category}
              </span>
              {community.visibility === 'PRIVATE' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warning">
                  <Lock className="h-3 w-3" /> Private
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                  <Globe className="h-3 w-3" /> Public
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/80 bg-surface-muted/40 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Members</span>
            <div className="text-base font-extrabold text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> {community.memberCount || 1}
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-surface-muted/40 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Channels</span>
            <div className="text-base font-extrabold text-foreground flex items-center gap-1.5">
              <Hash className="h-4 w-4 text-indigo-500" /> {community.channels?.length || 0}
            </div>
          </div>
        </div>

        {/* About Description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground-muted">About</h4>
          <p className="text-xs text-foreground leading-relaxed bg-surface-muted/30 p-3.5 rounded-2xl border border-border/60">
            {community.description || 'Campus student community for discussion, project collaboration, and learning.'}
          </p>
        </div>

        {/* Member Role Banner */}
        <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-3.5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-primary">Your Role: {community.userRole || 'MEMBER'}</span>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center gap-3 pt-2">
          {isOwnerOrMod && onOpenSettings && (
            <button
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-surface-muted px-4 py-2.5 text-xs font-bold text-foreground border border-border hover:bg-surface-elevated transition-colors"
            >
              <Settings className="h-4 w-4" /> Settings
            </button>
          )}

          {community.userRole && community.userRole !== 'OWNER' && onLeaveCommunity && (
            <button
              onClick={() => {
                onClose();
                onLeaveCommunity();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Leave
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
