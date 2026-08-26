import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '../api/profile'
import type { UserProfile } from '../api/profile'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import { useNavigate } from '@tanstack/react-router'

export const AUTH_QUERY_KEY = ['auth', 'me']

export function useAuth() {
  const queryClient = useQueryClient()

  const {
    data: profile,
    isLoading,
    isPending,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<UserProfile | null, ApiError>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => profileApi.getMe(),
    retry: (failureCount, err) => {
      if (err.status === 401 || err.status === 403 || err.status === 404) return false
      return failureCount < 3
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (user profile rarely changes itself without mutations)
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  const navigate = useNavigate()

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: async () => {
      // 1. Cancel pending queries to prevent stale responses
      await queryClient.cancelQueries()
      // 2. Clear query cache
      queryClient.clear()
      // 3. Disconnect sockets (handled by isAuthenticated state change)
      // 4. Navigate to login safely without hard reload
      navigate({ to: '/login', replace: true })
    },
  })

  let status: 'loading' | 'authenticated' | 'unauthenticated' | 'needs_onboarding' | 'error' = 'loading'
  if (isPending) {
    status = 'loading'
  } else if (isError) {
    if (error?.status === 401) {
      status = 'unauthenticated'
    } else if (error?.status === 404) {
      status = 'needs_onboarding'
    } else {
      status = profile ? 'authenticated' : 'error'
    }
  } else if (profile === null) {
    status = 'needs_onboarding'
  } else if (profile) {
    status = 'authenticated'
  }
  

  return {
    status,
    user: profile || null,
    profile: profile || null,
    isAuthenticated: status === 'authenticated' || status === 'needs_onboarding',
    isUnauthenticated: status === 'unauthenticated',
    needsOnboarding: status === 'needs_onboarding',
    isLoading,
    isPending,
    isFetching,
    isError,
    error,
    logout: () => logoutMutation.mutateAsync(),
    refetchSession: refetch,
  }
}
