import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '../api/profile'
import type { UserProfile } from '../api/profile'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import { useNavigate } from '@tanstack/react-router'
import { useRef } from 'react'

export const AUTH_QUERY_KEY = ['auth', 'me']

export function useAuth() {
  const queryClient = useQueryClient()
  const logoutGuardRef = useRef(false)

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
      if (err.status === 401 || err.status === 403 || err.status === 404 || err.status === 429) return false
      return failureCount < 3
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  const navigate = useNavigate()

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onMutate: async () => {
      logoutGuardRef.current = true
      await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEY })
    },
    onSettled: async () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null)
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth'
      })
      logoutGuardRef.current = false
      navigate({ to: '/login', replace: true })
    },
  })

  let status: 'loading' | 'authenticated' | 'unauthenticated' | 'needs_onboarding' | 'error' = 'loading'
  if (logoutGuardRef.current) {
    status = 'unauthenticated'
  } else if (isPending) {
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
