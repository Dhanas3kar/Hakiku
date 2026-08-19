import { useQuery } from '@tanstack/react-query'
import { communityApi } from '../../api/community'
import { Users, TrendingUp } from 'lucide-react'

export function CampusInsights() {
  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['campus-insights'],
    queryFn: () => communityApi.getInsights(),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">Your Insights</h2>
        <div className="h-32 bg-surface-muted rounded-2xl animate-pulse" />
      </section>
    )
  }

  if (error || !insights) {
    return null
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Campus Insights</h2>
      </div>
      
      <div className="p-5 bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">
            {insights.campus}
          </p>
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <Users className="h-4 w-4" />
            <span>
              {insights.newStudentsThisMonth 
                ? `${insights.newStudentsThisMonth} new students joined this month` 
                : 'Activity is quiet this month'}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
