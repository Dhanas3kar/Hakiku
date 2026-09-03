import { useQuery } from '@tanstack/react-query'
import { client as api } from '../../api/client'
import { AlertCircle } from 'lucide-react'

export function ConfessionHero() {
  const { data, isLoading } = useQuery({
    queryKey: ['confessions', 'trending'],
    queryFn: () => api.get('/community/confessions/hero'),
  })

  if (isLoading || !data?.length) return null

  return (
    <div className="w-full bg-indigo-500/10 border-b border-indigo-500/20 overflow-hidden py-3 relative flex items-center shrink-0">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-surface to-transparent z-10"></div>
      
      <div className="flex whitespace-nowrap animate-marquee">
        {data.map((confession: any, idx: number) => (
          <span key={confession.id} className="inline-flex items-center mx-4 text-sm font-medium">
            <span className="text-indigo-400 mr-2 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              HOT
            </span>
            <span className="text-foreground-muted truncate max-w-xs">{confession.content}</span>
            {idx !== data.length - 1 && <span className="mx-4 text-border">•</span>}
          </span>
        ))}
        {/* Duplicate for seamless loop */}
        {data.map((confession: any, idx: number) => (
          <span key={`dup-${confession.id}`} className="inline-flex items-center mx-4 text-sm font-medium" aria-hidden="true">
            <span className="text-indigo-400 mr-2 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              HOT
            </span>
            <span className="text-foreground-muted truncate max-w-xs">{confession.content}</span>
            {idx !== data.length - 1 && <span className="mx-4 text-border">•</span>}
          </span>
        ))}
      </div>

      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-surface to-transparent z-10"></div>
    </div>
  )
}
