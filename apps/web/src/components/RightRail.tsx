import { useInfiniteQuery } from '@tanstack/react-query'
import { communityApi } from '../api/community'
import { Link } from '@tanstack/react-router'
import { Avatar } from './ui/Avatar'
import { Skeleton } from './ui/Skeleton'

export function RightRail() {
  const { data, isLoading } = useInfiniteQuery({
    queryKey: ['people-worth-knowing'],
    queryFn: ({ pageParam }) => communityApi.getRecommendations({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursorAt,
    staleTime: 5 * 60 * 1000,
  })

  const people = (data?.pages.flatMap((page) => page.items) ?? []).slice(0, 5)

  return (
    <aside className="hidden w-72 shrink-0 xl:block">
      <div className="sticky top-8 flex flex-col gap-8">
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            People worth knowing
          </h3>
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : people.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              Suggestions will appear as more people join campus.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {people.map((person) => (
                <Link
                  key={person.id}
                  to="/profile/$username"
                  params={{ username: person.username || person.id }}
                  className="flex items-center gap-3 rounded-md p-1 -mx-1 hover:bg-surface-muted transition-colors duration-150"
                >
                  <Avatar src={person.avatarUrl} name={person.displayName} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{person.displayName}</p>
                    <p className="truncate text-xs text-foreground-muted">
                      {person.headline || person.campus || 'SRM student'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-foreground-subtle">
          &copy; {new Date().getFullYear()} HAKIKU
        </p>
      </div>
    </aside>
  )
}
