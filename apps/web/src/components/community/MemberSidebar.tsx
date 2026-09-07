import { type CommunityMember } from '../../api/communities';
import { Avatar } from '../ui/Avatar';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { isUserVerified } from '../../utils/user';
import { Crown, Shield, X } from 'lucide-react';

interface MemberSidebarProps {
  members?: CommunityMember[];
  totalCount?: number;
  onClose?: () => void;
  onSelectMember?: (userId: string) => void;
}

export function MemberSidebar({
  members = [],
  totalCount = 1,
  onClose,
  onSelectMember,
}: MemberSidebarProps) {
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
              const verified = isUserVerified({
                username: mem.profile?.username,
                fullName: mem.profile?.fullName,
                isVerifiedIdentity: mem.profile?.isVerifiedIdentity,
                role: mem.role === 'OWNER' || mem.role === 'MODERATOR' ? 'ADMIN' : mem.profile?.systemRole,
              });

              return (
                <div
                  key={mem.id || mem.userId}
                  onClick={() => onSelectMember?.(mem.userId)}
                  className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-surface-muted/80 cursor-pointer"
                >
                  {/* Avatar & Online Dot */}
                  <div className="relative shrink-0">
                    <Avatar
                      src={mem.profile?.avatarUrl}
                      name={mem.profile?.fullName || 'Student Member'}
                      size="sm"
                    />
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
                  </div>

                  {/* Name & Role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-xs font-bold text-foreground truncate group-hover:underline">
                        {mem.profile?.fullName || 'Student Member'}
                      </span>
                      {verified && <VerifiedBadge className="h-3.5 w-3.5 shrink-0" />}
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

