export function RightRail() {
  return (
    <aside className="hidden w-80 shrink-0 lg:block">
      <div className="sticky top-20 flex flex-col gap-6">
        {/* Campus Pulse Placeholder */}
        <div className="rounded-xl border border-border bg-surface-elevated p-5 shadow-sm dark:shadow-none transition-colors">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Campus Pulse</h3>
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="h-4 w-3/4 animate-pulse rounded bg-surface-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
              </div>
            ))}
          </div>
        </div>

        {/* People Worth Knowing Placeholder */}
        <div className="rounded-xl border border-border bg-surface-elevated p-5 shadow-sm dark:shadow-none transition-colors">
          <h3 className="mb-4 text-sm font-semibold text-foreground">People Worth Knowing</h3>
          <div className="flex flex-col gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-surface-muted" />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="h-3.5 w-full animate-pulse rounded bg-surface-muted" />
                  <div className="h-2.5 w-2/3 animate-pulse rounded bg-surface-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-auto px-1 text-xs text-foreground-muted">
          <p>&copy; {new Date().getFullYear()} SRM Connect</p>
        </div>
      </div>
    </aside>
  )
}
