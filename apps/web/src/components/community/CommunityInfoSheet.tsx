import { type Community } from '../../api/communities';
import {
  X,
  Globe,
  Lock,
  Users,
  Hash,
  Settings,
  LogOut,
  Crown,
} from 'lucide-react';

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

  const initials =
    community.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase() || 'CM';

  const isOwnerOrMod =
    community.userRole === 'OWNER' ||
    community.userRole === 'MODERATOR';

  const canLeave =
    Boolean(community.userRole) &&
    community.userRole !== 'OWNER' &&
    Boolean(onLeaveCommunity);

  const memberCount = community.memberCount ?? 1;
  const channelCount = community.channels?.length ?? 0;

  const description =
    community.description?.trim() ||
    'Campus student community for discussion, project collaboration, and learning.';

  const handleSettings = () => {
    onClose();
    onOpenSettings?.();
  };

  const handleLeave = () => {
    onClose();
    onLeaveCommunity?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-info-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close community information"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      />

      {/* Modal */}
      <div className="relative z-10 flex w-full max-w-md max-h-[90vh] flex-col overflow-y-auto rounded-3xl border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative flex items-center gap-4 border-b border-border p-5 pr-14">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-lg font-black text-white shadow-md"
            aria-hidden="true"
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2
                id="community-info-title"
                className="truncate text-lg font-bold text-foreground"
              >
                {community.name}
              </h2>

              {community.visibility === 'PRIVATE' ? (
                <Lock
                  className="h-3.5 w-3.5 shrink-0 text-warning"
                  aria-label="Private community"
                />
              ) : (
                <Globe
                  className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                  aria-label="Public community"
                />
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                {community.category}
              </span>

              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold ${community.visibility === 'PRIVATE'
                    ? 'text-warning'
                    : 'text-emerald-500'
                  }`}
              >
                {community.visibility === 'PRIVATE' ? (
                  <>
                    <Lock className="h-3 w-3" />
                    Private
                  </>
                ) : (
                  <>
                    <Globe className="h-3 w-3" />
                    Public
                  </>
                )}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-5">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/80 bg-surface-muted/40 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                Members
              </span>

              <div className="mt-1 flex items-center gap-1.5 text-base font-extrabold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                {memberCount.toLocaleString()}
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-surface-muted/40 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                Channels
              </span>

              <div className="mt-1 flex items-center gap-1.5 text-base font-extrabold text-foreground">
                <Hash className="h-4 w-4 text-indigo-500" />
                {channelCount.toLocaleString()}
              </div>
            </div>
          </div>

          {/* About */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted">
              About
            </h3>

            <p className="rounded-2xl border border-border/60 bg-surface-muted/30 p-3.5 text-xs leading-relaxed text-foreground">
              {description}
            </p>
          </section>

          {/* Role */}
          <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 p-3.5">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />

              <span className="text-xs font-bold text-primary">
                Your Role
              </span>
            </div>

            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
              {community.userRole || 'MEMBER'}
            </span>
          </div>
        </div>

        {/* Footer */}
        {(isOwnerOrMod || canLeave) && (
          <div className="flex gap-3 border-t border-border p-5">
            {isOwnerOrMod && onOpenSettings && (
              <button
                type="button"
                onClick={handleSettings}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-surface-muted px-4 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
            )}

            {canLeave && (
              <button
                type="button"
                onClick={handleLeave}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-500 transition-colors hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              >
                <LogOut className="h-4 w-4" />
                Leave
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}