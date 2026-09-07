import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  ChevronDown,
  Crown,
  Globe,
  Hash,
  Info,
  Lock,
  LogOut,
  MoreVertical,
  Settings,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { type Community, type CommunityChannel } from '../../api/communities';

interface CommunityHeaderProps {
  community: Community;
  activeChannel?: CommunityChannel;
  onOpenChannels: () => void;
  onOpenMembers: () => void;
  onOpenInfo: () => void;
  onOpenSettings?: () => void;
  onLeaveCommunity?: () => void;
}

export function CommunityHeader({
  community,
  activeChannel,
  onOpenChannels,
  onOpenMembers,
  onOpenInfo,
  onOpenSettings,
  onLeaveCommunity,
}: CommunityHeaderProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPrivate = community.visibility === 'PRIVATE';
  const isModerator =
    community.userRole === 'OWNER' || community.userRole === 'MODERATOR';

  const initials = community.name
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const memberCount = community.memberCount || 1;
  const userRole = community.userRole || 'MEMBER';

  // Close menu when clicking outside.
  useEffect(() => {
    if (!showMoreMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setShowMoreMenu(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [showMoreMenu]);

  // Close menu with Escape.
  useEffect(() => {
    if (!showMoreMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMoreMenu(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMoreMenu]);

  const closeMenu = () => {
    setShowMoreMenu(false);
  };

  const handleInfo = () => {
    closeMenu();
    onOpenInfo();
  };

  const handleMembers = () => {
    closeMenu();
    onOpenMembers();
  };

  const handleSettings = () => {
    closeMenu();
    onOpenSettings?.();
  };

  const handleLeave = () => {
    closeMenu();
    onLeaveCommunity?.();
  };

  return (
    <header
      className="
        sticky top-0 z-30
        flex h-14 w-full items-center justify-between
        border-b border-border/80
        bg-surface/95 px-2 sm:px-4
        backdrop-blur-md
      "
    >
      {/* ───────────────── LEFT ───────────────── */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        {/* Back */}
        <Link
          to="/communities"
          aria-label="Back to Communities"
          title="Back to Communities"
          className="
            flex h-9 w-9 shrink-0 items-center justify-center
            rounded-xl
            text-foreground-muted
            transition-colors
            hover:bg-surface-muted
            hover:text-foreground
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-primary/50
          "
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Community identity */}
        <button
          type="button"
          onClick={onOpenInfo}
          aria-label={`Open ${community.name} information`}
          className="
            flex min-w-0 items-center gap-2
            rounded-xl p-1
            text-left
            transition-colors
            hover:bg-surface-muted/60
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-primary/50
          "
        >
          {/* Avatar */}
          <div
            aria-hidden="true"
            className="
              flex h-8 w-8 shrink-0 items-center justify-center
              rounded-xl
              bg-gradient-to-br from-primary to-indigo-600
              text-xs font-black text-white
              shadow-xs
            "
          >
            {initials}
          </div>

          {/* Name + channel */}
          <div className="flex min-w-0 flex-col leading-tight">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="
                  max-w-[170px]
                  truncate
                  text-xs font-bold text-foreground
                  xs:max-w-[220px]
                  sm:max-w-[320px]
                "
              >
                {community.name}
              </span>

              {isPrivate ? (
                <Lock
                  aria-label="Private community"
                  className="h-3 w-3 shrink-0 text-warning"
                />
              ) : (
                <Globe
                  aria-label="Public community"
                  className="h-3 w-3 shrink-0 text-emerald-500"
                />
              )}
            </div>

            {/* Mobile channel selector */}
            <span
              className="
                flex items-center gap-1
                text-[11px] font-semibold text-primary
                md:hidden
              "
            >
              <Hash className="h-3 w-3 shrink-0" />

              <span className="max-w-[130px] truncate">
                {activeChannel?.name || 'select-channel'}
              </span>
            </span>
          </div>
        </button>

        {/* Mobile channel button overlay */}
        <button
          type="button"
          onClick={onOpenChannels}
          aria-label="Select channel"
          className="
            -ml-1 flex h-8 w-7 shrink-0
            items-center justify-center
            rounded-lg
            text-foreground-muted
            transition-colors
            hover:bg-surface-muted
            md:hidden
          "
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {/* Desktop metadata */}
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {/* Category */}
          <span
            className="
              inline-flex items-center
              rounded-md
              border border-border/60
              bg-surface-muted
              px-2 py-0.5
              text-[10px] font-bold uppercase
              tracking-wider
              text-foreground-muted
            "
          >
            {community.category}
          </span>

          {/* Role */}
          <span
            className="
              inline-flex items-center gap-1
              rounded-md
              border border-primary/20
              bg-primary/10
              px-2 py-0.5
              text-[10px] font-bold
              text-primary
            "
          >
            {community.userRole === 'OWNER' && (
              <Crown
                aria-hidden="true"
                className="h-3 w-3 text-amber-500"
              />
            )}

            {userRole}
          </span>
        </div>
      </div>

      {/* ───────────────── RIGHT ───────────────── */}
      <div className="ml-1 flex shrink-0 items-center gap-0.5 sm:gap-1">
        {/* Members */}
        <button
          type="button"
          onClick={onOpenMembers}
          aria-label={`View ${memberCount} community members`}
          title="Community Members"
          className="
            flex h-9 items-center gap-1.5
            rounded-xl px-2
            text-xs font-semibold
            text-foreground-muted
            transition-colors
            hover:bg-surface-muted
            hover:text-foreground
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-primary/50
            sm:px-2.5
          "
        >
          <Users className="h-4 w-4" />

          <span className="hidden sm:inline">
            {memberCount}
          </span>
        </button>

        {/* Info */}
        <button
          type="button"
          onClick={onOpenInfo}
          aria-label="Community information"
          title="Community Info"
          className="
            flex h-9 w-9 items-center justify-center
            rounded-xl
            text-foreground-muted
            transition-colors
            hover:bg-surface-muted
            hover:text-foreground
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-primary/50
          "
        >
          <Info className="h-4 w-4" />
        </button>

        {/* Moderator settings */}
        {isModerator && onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Community settings"
            title="Community Settings"
            className="
              flex h-9 w-9 items-center justify-center
              rounded-xl
              text-foreground-muted
              transition-colors
              hover:bg-surface-muted
              hover:text-foreground
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-primary/50
            "
          >
            <Settings className="h-4 w-4" />
          </button>
        )}

        {/* More menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowMoreMenu((previous) => !previous)}
            aria-label="More community actions"
            aria-haspopup="menu"
            aria-expanded={showMoreMenu}
            title="More Actions"
            className="
              flex h-9 w-9 items-center justify-center
              rounded-xl
              text-foreground-muted
              transition-colors
              hover:bg-surface-muted
              hover:text-foreground
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-primary/50
            "
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {showMoreMenu && (
            <div
              role="menu"
              aria-label="Community actions"
              className="
                absolute right-0 top-11 z-50
                w-48
                rounded-2xl
                border border-border
                bg-surface
                p-1.5
                shadow-xl
                animate-in
                fade-in
                zoom-in-95
                duration-150
              "
            >
              {/* About */}
              <button
                type="button"
                role="menuitem"
                onClick={handleInfo}
                className="
                  flex w-full items-center gap-2
                  rounded-xl px-3 py-2
                  text-xs font-medium
                  text-foreground
                  transition-colors
                  hover:bg-surface-muted
                "
              >
                <Info className="h-3.5 w-3.5 text-foreground-muted" />
                About Community
              </button>

              {/* Members */}
              <button
                type="button"
                role="menuitem"
                onClick={handleMembers}
                className="
                  flex w-full items-center gap-2
                  rounded-xl px-3 py-2
                  text-xs font-medium
                  text-foreground
                  transition-colors
                  hover:bg-surface-muted
                "
              >
                <Users className="h-3.5 w-3.5 text-foreground-muted" />
                View Members
              </button>

              {/* Settings */}
              {isModerator && onOpenSettings && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSettings}
                  className="
                    flex w-full items-center gap-2
                    rounded-xl px-3 py-2
                    text-xs font-medium
                    text-foreground
                    transition-colors
                    hover:bg-surface-muted
                  "
                >
                  <Settings className="h-3.5 w-3.5 text-foreground-muted" />
                  Settings & Roles
                </button>
              )}

              {/* Leave */}
              {community.userRole &&
                community.userRole !== 'OWNER' &&
                onLeaveCommunity && (
                  <div className="mt-1 border-t border-border-subtle pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLeave}
                      className="
                        flex w-full items-center gap-2
                        rounded-xl px-3 py-2
                        text-xs font-medium
                        text-rose-500
                        transition-colors
                        hover:bg-rose-500/10
                      "
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Leave Community
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
