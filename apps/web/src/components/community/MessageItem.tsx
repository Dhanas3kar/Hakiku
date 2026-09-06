import { type CommunityMessage } from '../../api/communities';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface MessageItemProps {
  message: CommunityMessage;
}

function getInitials(name?: string | null) {
  if (!name) return 'SM';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
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

export function MessageItem({ message }: MessageItemProps) {
  const [isCopied, setIsCopied] = useState(false);
  const initials = getInitials(message.senderName);
  const formattedTime = formatMessageTime(message.createdAt);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="group relative flex items-start gap-3 rounded-2xl p-2 sm:p-2.5 transition-colors hover:bg-surface-muted/60">
      {/* Sender Avatar */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 font-extrabold text-xs text-white shadow-xs">
        {initials}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-foreground hover:underline cursor-pointer">
            {message.senderName || 'Student Member'}
          </span>
          <span className="text-[10px] font-semibold text-foreground-muted">
            {formattedTime}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
      </div>

      {/* Hover / Touch Quick Action Bar */}
      <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 rounded-xl border border-border/80 bg-surface px-1.5 py-1 shadow-sm">
        <button
          onClick={handleCopy}
          className="rounded-lg p-1 text-foreground-muted hover:bg-surface-muted hover:text-foreground transition-colors"
          title="Copy message"
        >
          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
