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
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      // Completely reset auth state and clear queries on logout
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY })
      queryClient.clear()
    },
  })

  let status: 'loading' | 'authenticated' | 'unauthenticated' | 'needs_onboarding' = 'loading'
  if (isPending) {
    status = 'loading'
  } else if (isError) {
    status = 'unauthenticated'
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
