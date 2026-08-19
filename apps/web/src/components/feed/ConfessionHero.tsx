import { useQuery } from '@tanstack/react-query'
import { confessionsApi } from '../../api/confessions'
import { Sparkles, Clock, Shield } from 'lucide-react'

export function ConfessionHero() {
  const { data: confession, isLoading } = useQuery({
    queryKey: ['confessions', 'hero'],
    queryFn: () => confessionsApi.getHeroConfession(),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading || !confession) {
    return null
  }

  return (
    <aside aria-label="Featured Anonymous Confession" className="mb-6 rounded-xl border border-border/80 bg-surface-elevated/40 p-4 sm:p-5 shadow-xs backdrop-blur-xs transition-colors">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Hero Confession</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-success" />
            <span>Anonymous</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>24h Featured</span>
          </span>
        </div>
      </div>
      <p className="text-sm sm:text-base text-foreground leading-relaxed italic">
        "{confession.content}"
      </p>
    </aside>
  )
}
