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
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000,
    refetchInterval: 15000, // Poll every 15 seconds to catch status updates immediately
    refetchOnMount: true,
    refetchOnWindowFocus: true,
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
      logoutGuardRef.current = true
      queryClient.setQueryData(AUTH_QUERY_KEY, null)
      queryClient.removeQueries()
      queryClient.clear()
      logoutGuardRef.current = false
      navigate({ to: '/login', replace: true })
    },
  })

  let status: 'loading' | 'authenticated' | 'unauthenticated' | 'needs_onboarding' | 'error' | 'suspended' = 'loading'
  if (logoutGuardRef.current) {
    status = 'unauthenticated'
  } else if (isPending) {
    status = 'loading'
  } else if (isError) {
    if (error?.status === 401 || error?.status === 403) {
      status = 'unauthenticated'
    } else if (error?.status === 404) {
      status = 'needs_onboarding'
    } else {
      status = profile ? 'authenticated' : 'unauthenticated'
    }
  } else if (!profile) {
    status = 'unauthenticated'
  } else if (profile.status === 'SUSPENDED') {
    status = 'suspended'
  } else if (profile) {
    const isIncomplete = !profile.username || (profile as any).isOnboarded === false
    status = isIncomplete ? 'needs_onboarding' : 'authenticated'
  }

  const isAuthenticated = status === 'authenticated' || status === 'needs_onboarding' || status === 'suspended'
  const isUnauthenticated = status === 'unauthenticated' || status === 'error'

  return {
    status,
    user: profile || null,
    profile: profile || null,
    isAuthenticated,
    isUnauthenticated,
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
