interface Props {
  count?: number
}

export function FeedSkeleton({ count = 3 }: Props = {}) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5 shadow-xs animate-pulse">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-surface-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-32 bg-surface-muted rounded" />
              <div className="h-3 w-24 bg-surface-muted rounded" />
            </div>
          </div>
          
          {/* Content */}
          <div className="space-y-2 mb-4">
            <div className="h-4 w-full bg-surface-muted rounded" />
            <div className="h-4 w-[90%] bg-surface-muted rounded" />
            <div className="h-4 w-[60%] bg-surface-muted rounded" />
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-4 pt-3 border-t border-border/60">
            <div className="h-8 w-16 bg-surface-muted rounded-lg" />
            <div className="h-8 w-16 bg-surface-muted rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}
