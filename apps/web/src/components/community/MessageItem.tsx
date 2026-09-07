import { type CommunityMessage } from '../../api/communities';
import { Avatar } from '../ui/Avatar';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { isUserVerified } from '../../utils/user';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface MessageItemProps {
  message: CommunityMessage;
  isGrouped?: boolean;
  onSelectSender?: (userId: string) => void;
}

function formatMessageTime(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Today at ${timeStr}`;
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

function formatShortTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageItem({ message, isGrouped = false, onSelectSender }: MessageItemProps) {
  const [isCopied, setIsCopied] = useState(false);
  const formattedTime = formatMessageTime(message.createdAt);
  const shortTime = formatShortTime(message.createdAt);

  const isVerifiedSender = isUserVerified({
    displayName: message.senderName,
    isVerifiedIdentity: message.isSenderVerified,
    role: message.senderRole,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isGrouped) {
    return (
      <div className="group relative flex items-center gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-surface-muted/60 pl-14">
        {/* Left timestamp visible on hover */}
        <span className="absolute left-2 hidden text-[10px] font-semibold text-foreground-muted/70 group-hover:inline transition-opacity select-none">
          {shortTime}
        </span>

        {/* Message Content */}
        <p className="flex-1 min-w-0 text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>

        {/* Quick Action Bar */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 rounded-xl border border-border/80 bg-surface px-1.5 py-1 shadow-sm z-10">
          <button
            onClick={handleCopy}
            className="rounded-lg p-1 text-foreground-muted hover:bg-surface-muted hover:text-foreground transition-colors cursor-pointer"
            title="Copy message"
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex items-start gap-3 rounded-2xl p-2 sm:p-2.5 transition-colors hover:bg-surface-muted/60 mt-2">
      {/* Sender Avatar */}
      <button
        onClick={() => onSelectSender?.(message.senderId)}
        className="shrink-0 transition-opacity hover:opacity-85 cursor-pointer text-left focus:outline-hidden"
      >
        <Avatar
          src={message.senderAvatar}
          name={message.senderName || 'Student Member'}
          size="sm"
        />
      </button>

      {/* Message Body */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            onClick={() => onSelectSender?.(message.senderId)}
            className="text-xs font-bold text-foreground hover:underline cursor-pointer"
          >
            {message.senderName || 'Student Member'}
          </span>
          {isVerifiedSender && <VerifiedBadge className="h-3.5 w-3.5 shrink-0" />}
          <span className="text-[10px] font-semibold text-foreground-muted">
            {formattedTime}
          </span>
        </div>


        <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
      </div>

      {/* Hover / Touch Quick Action Bar */}
      <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 rounded-xl border border-border/80 bg-surface px-1.5 py-1 shadow-sm z-10">
        <button
          onClick={handleCopy}
          className="rounded-lg p-1 text-foreground-muted hover:bg-surface-muted hover:text-foreground transition-colors cursor-pointer"
          title="Copy message"
        >
          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

