import { useQuery } from '@tanstack/react-query'
import { confessionsApi } from '../../api/confessions'
import { Sparkles, Clock, Shield } from 'lucide-react'

export function ConfessionHero() {
  const { data: result, isLoading } = useQuery({
    queryKey: ['confessions', 'hero'],
    queryFn: () => confessionsApi.getHeroConfession(),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return null
  }

  const confessions = result?.items || []
  const isFallback = result?.isFallback || false

  // To create a continuous loop, we duplicate the confessions if there are few
  const items = confessions.length > 0 
    ? [...confessions, ...confessions, ...confessions].slice(0, Math.max(6, confessions.length * 2))
    : []

  return (
    <aside aria-label="Featured Anonymous Confessions" className="mx-4 sm:mx-0 mb-2 rounded-none sm:rounded-md border-y sm:border border-border-subtle bg-surface px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 mb-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Hot Confessions</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-success" />
            <span>Anonymous</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{isFallback ? 'Featured' : '24h Featured'}</span>
          </span>
        </div>
      </div>
      
      {/* Marquee Container */}
      <div className="relative w-full overflow-hidden flex" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
        {items.length > 0 ? (
          <div className="flex w-max animate-marquee gap-8 whitespace-nowrap hover:[animation-play-state:paused]">
            {items.map((confession, i) => (
              <div key={`${confession.id}-${i}`} className="text-sm sm:text-base text-foreground leading-relaxed italic shrink-0">
                "{confession.content}"
              </div>
            ))}
          </div>
        ) : (
          <div className="flex w-full items-center justify-center py-4 text-sm text-foreground-muted italic">
            No featured confessions right now. Check back later!
          </div>
        )}
      </div>
    </aside>
  )
}
