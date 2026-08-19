import { useQuery } from '@tanstack/react-query'
import { communityApi } from '../../api/community'
import { Eye, Heart, Users, TrendingUp } from 'lucide-react'

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
        <h2 className="text-lg font-bold text-foreground">Your Weekly Insights</h2>
      </div>
      
      <div className="p-5 bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center p-3 bg-surface rounded-xl shadow-sm">
            <Eye className="h-5 w-5 text-blue-500 mb-2" />
            <span className="text-2xl font-bold text-foreground">{insights.profileViews}</span>
            <span className="text-xs text-foreground-muted text-center mt-1">Profile Views</span>
          </div>
          
          <div className="flex flex-col items-center p-3 bg-surface rounded-xl shadow-sm">
            <Heart className="h-5 w-5 text-red-500 mb-2" />
            <span className="text-2xl font-bold text-foreground">{insights.postEngagements}</span>
            <span className="text-xs text-foreground-muted text-center mt-1">Engagements</span>
          </div>

          <div className="flex flex-col items-center p-3 bg-surface rounded-xl shadow-sm">
            <Users className="h-5 w-5 text-green-500 mb-2" />
            <span className="text-2xl font-bold text-foreground">{insights.networkGrowth}</span>
            <span className="text-xs text-foreground-muted text-center mt-1">New Connections</span>
          </div>
        </div>

        {insights.weeklyChange > 0 && (
          <div className="mt-4 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Up {insights.weeklyChange}% from last week
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
