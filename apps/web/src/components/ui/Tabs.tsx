import { cn } from '../../lib/cn'

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto rounded-md bg-surface-muted p-1 scrollbar-hide"
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'min-w-max flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors duration-150',
              active
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-foreground-muted hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
