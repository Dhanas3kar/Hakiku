import { useInfiniteQuery } from '@tanstack/react-query'
import { communityApi } from '../../api/community'
import { Sparkles, UserPlus } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export function PeopleWorthKnowing() {
  const { data, isLoading, error } = useInfiniteQuery({
    queryKey: ['people-worth-knowing'],
    queryFn: ({ pageParam }) => communityApi.getRecommendations({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursorAt,
    staleTime: 5 * 60 * 1000,
  })

  const recommendations = data?.pages.flatMap(page => page.items) ?? []

  if (isLoading) {
    return (
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">People Worth Knowing</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="min-w-[200px] h-48 bg-surface-muted rounded-2xl animate-pulse shrink-0" />
          ))}
        </div>
      </section>
    )
  }

  if (error || recommendations.length === 0) {
    return null
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-bold text-foreground">People Worth Knowing</h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x">
        {recommendations.map((person) => (
          <div 
            key={person.id} 
            className="min-w-[220px] max-w-[240px] flex flex-col items-center p-5 bg-surface-muted border border-border rounded-2xl shrink-0 snap-start"
          >
            <Link to={`/profile/${(person as any).username || person.id}`} className="flex flex-col items-center group">
              <div className="relative mb-3">
                {person.avatarUrl ? (
                  <img src={person.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-surface group-hover:ring-primary transition-all" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-surface group-hover:ring-primary transition-all">
                    <span className="text-xl font-medium">{person.displayName?.[0] || '?'}</span>
                  </div>
                )}
              </div>
              
              <h3 className="font-semibold text-foreground text-center truncate w-full">
                {person.displayName}
              </h3>
              
              <p className="text-xs text-foreground-muted text-center mt-1 line-clamp-2 min-h-[32px]">
                {person.headline || `${person.campus || 'SRM'} Student`}
              </p>
            </Link>

            {person.reasons && person.reasons.length > 0 && (
              <div className="mt-3 px-2 py-1 bg-surface rounded-md text-[10px] font-medium text-foreground-muted text-center w-full truncate">
                {person.reasons[0]}
              </div>
            )}

            <button className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors text-sm font-medium">
              <UserPlus className="h-4 w-4" />
              Connect
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
