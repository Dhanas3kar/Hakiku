import { Hash, MessageSquare } from 'lucide-react';

interface EmptyChannelStateProps {
  channelName?: string;
  onSelectPrompt: (promptText: string) => void;
}

export function EmptyChannelState({ channelName = 'general', onSelectPrompt }: EmptyChannelStateProps) {
  return (
    <div className="my-auto flex flex-col items-center justify-center p-6 sm:p-10 text-center space-y-4 max-w-md mx-auto">
      {/* Icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
        <MessageSquare className="h-7 w-7" />
      </div>

      {/* Onboarding Header & Context */}
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-foreground flex items-center justify-center gap-1.5">
          Welcome to <span className="text-primary font-extrabold flex items-center"><Hash className="h-4 w-4 inline" />{channelName}</span>
        </h3>
        <p className="text-xs text-foreground-muted leading-relaxed">
          This is the beginning of this channel. Start the conversation with your community.
        </p>
      </div>

      {/* Compact Suggestion Starter Chips */}
      <div className="pt-2 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => onSelectPrompt('👋 Hey everyone! Excited to be part of this community.')}
          className="rounded-xl border border-border/80 bg-surface px-3 py-2 text-xs font-semibold text-foreground-muted hover:border-primary/50 hover:bg-surface-elevated hover:text-foreground transition-all duration-150 shadow-2xs"
        >
          👋 Introduce yourself
        </button>
        <button
          onClick={() => onSelectPrompt('🚀 Hey team! Currently building a project and looking for feedback.')}
          className="rounded-xl border border-border/80 bg-surface px-3 py-2 text-xs font-semibold text-foreground-muted hover:border-primary/50 hover:bg-surface-elevated hover:text-foreground transition-all duration-150 shadow-2xs"
        >
          🚀 Share a project
        </button>
        <button
          onClick={() => onSelectPrompt('❓ Does anyone have resources or insights to share on this topic?')}
          className="rounded-xl border border-border/80 bg-surface px-3 py-2 text-xs font-semibold text-foreground-muted hover:border-primary/50 hover:bg-surface-elevated hover:text-foreground transition-all duration-150 shadow-2xs"
        >
          ❓ Ask a question
        </button>
      </div>
    </div>
  );
}
