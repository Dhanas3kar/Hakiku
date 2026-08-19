import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '../api/profile'
import type { UserProfile } from '../api/profile'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'

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
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: async () => {
      // Completely reset auth state and clear queries on logout
      await queryClient.cancelQueries()
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY })
      queryClient.clear()
    },
  })

  let status: 'loading' | 'authenticated' | 'unauthenticated' | 'needs_onboarding' | 'error' = 'loading'
  if (isPending) {
    status = 'loading'
  } else if (isError) {
    if (error?.status === 401) {
      status = 'unauthenticated'
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
