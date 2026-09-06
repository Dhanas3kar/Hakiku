import { Link } from '@tanstack/react-router';
import { type Community, type CommunityChannel } from '../../api/communities';
import {
  ArrowLeft,
  Users,
  Info,
  Settings,
  MoreVertical,
  ChevronDown,
  Lock,
  Globe,
  Crown,
  Search,
  Sparkles,
  Hash,
  Shield,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';

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
  const initials = community.name.substring(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/80 bg-surface/95 px-3 sm:px-4 backdrop-blur-md">
      {/* LEFT SECTION: Back Link, Avatar, Name & Channel */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {/* Back Link */}
        <Link
          to="/communities"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          title="Back to Communities"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Community Avatar & Details */}
        <div
          onClick={onOpenInfo}
          className="flex items-center gap-2 min-w-0 cursor-pointer rounded-xl p-1 hover:bg-surface-muted/60 transition-colors"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-xs font-black text-white shadow-xs">
            {initials}
          </div>

          <div className="flex flex-col min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-xs sm:text-sm text-foreground truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[220px]">
                {community.name}
              </span>
              {community.visibility === 'PRIVATE' ? (
                <Lock className="h-3 w-3 text-warning shrink-0" />
              ) : (
                <Globe className="h-3 w-3 text-emerald-500 shrink-0" />
              )}
            </div>

            {/* Mobile Channel Switcher Selector */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenChannels();
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary md:hidden hover:underline truncate"
            >
              <Hash className="h-3 w-3 shrink-0" />
              <span className="truncate">{activeChannel?.name || 'select-channel'}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-foreground-muted" />
            </button>
          </div>
        </div>

        {/* Role Tag & Member Count (Tablet/Desktop Only) */}
        <div className="hidden items-center gap-2 sm:flex shrink-0">
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-foreground-muted uppercase tracking-wider border border-border/60">
            {community.category}
          </span>

          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
            {community.userRole === 'OWNER' && <Crown className="h-3 w-3 text-amber-500" />}
            {community.userRole || 'MEMBER'}
          </span>
        </div>
      </div>

      {/* RIGHT SECTION: Quick Action Buttons */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {/* Members Drawer Button (Tablet & Mobile Trigger) */}
        <button
          onClick={onOpenMembers}
          className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          title="Community Members"
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">{community.memberCount || 1}</span>
        </button>

        {/* Info Drawer Button */}
        <button
          onClick={onOpenInfo}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          title="Community Info"
        >
          <Info className="h-4 w-4" />
        </button>

        {/* Owner Settings / Moderation Button */}
        {(community.userRole === 'OWNER' || community.userRole === 'MODERATOR') && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            title="Community Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}

        {/* More Actions Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-11 z-50 w-48 rounded-2xl border border-border bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenInfo();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                <Info className="h-3.5 w-3.5 text-foreground-muted" /> About Community
              </button>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenMembers();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                <Users className="h-3.5 w-3.5 text-foreground-muted" /> View Members
              </button>

              {(community.userRole === 'OWNER' || community.userRole === 'MODERATOR') && onOpenSettings && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenSettings();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-muted"
                >
                  <Settings className="h-3.5 w-3.5 text-foreground-muted" /> Settings & Roles
                </button>
              )}

              {community.userRole && community.userRole !== 'OWNER' && onLeaveCommunity && (
                <div className="pt-1 mt-1 border-t border-border-subtle">
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onLeaveCommunity();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-500/10"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Leave Community
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
