import { type CommunityMember } from '../../api/communities';
import { Users, Crown, Shield, X, Sparkles } from 'lucide-react';

interface MemberSidebarProps {
  members?: CommunityMember[];
  totalCount?: number;
  onClose?: () => void;
}

function getInitials(name?: string | null) {
  if (!name) return 'SM';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function MemberSidebar({ members = [], totalCount = 1, onClose }: MemberSidebarProps) {
  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-l border-border/80 bg-surface/90 select-none">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border/80 px-4">
        <h3 className="font-bold text-xs uppercase tracking-wider text-foreground-muted">
          Members — {members.length || totalCount}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-foreground-muted hover:bg-surface-muted hover:text-foreground md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Member List Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="space-y-1">
          {members.length > 0 ? (
            members.map((mem) => {
              const initials = getInitials(mem.profile?.fullName);
              return (
                <div
                  key={mem.id || mem.userId}
                  className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-surface-muted/60"
                >
                  {/* Avatar & Online Dot */}
                  <div className="relative shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-xs text-white shadow-2xs">
                      {initials}
                    </div>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
                  </div>

                  {/* Name & Role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">
                        {mem.profile?.fullName || 'Student Member'}
                      </span>
                      {mem.role === 'OWNER' && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                      {mem.role === 'MODERATOR' && <Shield className="h-3 w-3 text-purple-500 shrink-0" />}
                    </div>

                    <span className="text-[10px] font-semibold text-foreground-muted block truncate">
                      {mem.profile?.department || mem.role}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-foreground-muted italic py-4 text-center">
              Loading members...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
