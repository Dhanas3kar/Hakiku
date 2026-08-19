import { useQuery } from '@tanstack/react-query'
import { communityApi } from '../../api/community'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'

export function CampusPulse() {
  const { data: pulseStats, isLoading, error } = useQuery({
    queryKey: ['campus-pulse'],
    queryFn: () => communityApi.getPulse(),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">Campus Pulse</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-surface-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (error || !pulseStats || pulseStats.length === 0) {
    return null // Fail silently for this decorative section
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Campus Pulse</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {pulseStats.map((stat) => (
          <div key={stat.id} className="p-4 bg-surface-muted rounded-2xl flex flex-col justify-between">
            <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
              {stat.category}
            </span>
            <div className="mt-2">
              <span className="text-2xl font-bold text-foreground">{stat.value}</span>
            </div>
            
            <div className="mt-2 flex items-center gap-1 text-xs font-medium">
              {stat.trend === 'up' && (
                <span className="text-green-500 flex items-center gap-0.5">
                  <TrendingUp className="h-3 w-3" />
                  {stat.trendValue ? `+${stat.trendValue}%` : 'Rising'}
                </span>
              )}
              {stat.trend === 'down' && (
                <span className="text-red-500 flex items-center gap-0.5">
                  <TrendingDown className="h-3 w-3" />
                  {stat.trendValue ? `${stat.trendValue}%` : 'Falling'}
                </span>
              )}
              {stat.trend === 'flat' && (
                <span className="text-foreground-muted flex items-center gap-0.5">
                  <Minus className="h-3 w-3" />
                  Stable
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
