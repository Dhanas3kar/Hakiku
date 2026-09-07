import { useState, useRef, useEffect } from 'react';
import { Send, Plus } from 'lucide-react';

interface MessageComposerProps {
  channelName?: string;
  onSendMessage: (content: string) => void;
  isSending?: boolean;
}

export function MessageComposer({
  channelName = 'channel',
  onSendMessage,
  isSending = false,
}: MessageComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea up to max 120px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    if (!value.trim() || isSending) return;
    onSendMessage(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="sticky bottom-0 z-20 w-full border-t border-border/80 bg-surface px-3 py-2 sm:px-4 sm:py-2.5 shadow-md">
      <div className="flex items-end gap-2 max-w-full">
        {/* Attachment Action Button */}
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-surface-muted/60 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground mb-0.5 cursor-pointer"
          title="Add attachment"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Textarea Input Container */}
        <div className="relative flex-1 min-w-0 flex items-center rounded-2xl border border-border/80 bg-surface-muted/60 px-3.5 py-2 transition-all focus-within:border-primary/80 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-surface">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}...`}
            className="w-full resize-none bg-transparent text-xs sm:text-sm text-foreground placeholder:text-foreground-muted/60 border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 scrollbar-hide leading-relaxed max-h-32 min-h-[24px]"
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() || isSending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-primary to-indigo-600 text-white font-bold shadow-md shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed mb-0.5 cursor-pointer"
          title="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
