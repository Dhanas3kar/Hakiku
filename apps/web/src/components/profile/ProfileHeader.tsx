import type { UserProfile } from '../../api/profile'
import { profileApi } from '../../api/profile'
import { networkingApi } from '../../api/networking'
import type { RelationshipStatus } from '../../api/networking'
import { User, Edit2, Upload, UserPlus, UserCheck, UserX, Clock, Ban, MoreHorizontal, MessageSquare } from 'lucide-react'
import { useState, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { EditProfileModal } from './EditProfileModal'

interface Props {
  profile: UserProfile
  isOwnProfile: boolean
}

export function ProfileHeader({ profile, isOwnProfile }: Props) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Relationship status (only fetched for other users' profiles)
  const { data: relationship } = useQuery<RelationshipStatus>({
    queryKey: ['relationship', profile.userId],
    queryFn: () => networkingApi.getRelationshipStatus(profile.userId),
    enabled: !isOwnProfile && !!profile.userId,
    retry: 1,
  })

  // --- Mutations ---

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profile.username] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => profileApi.uploadCover(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profile.username] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })

  const followMutation = useMutation({
    mutationFn: () => networkingApi.followUser(profile.userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['relationship', profile.userId] })
      const previous = queryClient.getQueryData<RelationshipStatus>(['relationship', profile.userId])
      if (previous) {
        queryClient.setQueryData<RelationshipStatus>(['relationship', profile.userId], {
          ...previous,
          isFollowing: true,
        })
      }
      return { previous }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['relationship', profile.userId], context.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] }),
  })

  const unfollowMutation = useMutation({
    mutationFn: () => networkingApi.unfollowUser(profile.userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['relationship', profile.userId] })
      const previous = queryClient.getQueryData<RelationshipStatus>(['relationship', profile.userId])
      if (previous) {
        queryClient.setQueryData<RelationshipStatus>(['relationship', profile.userId], {
          ...previous,
          isFollowing: false,
        })
      }
      return { previous }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['relationship', profile.userId], context.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] }),
  })

  const sendConnectionMutation = useMutation({
    mutationFn: () => networkingApi.sendConnectionRequest(profile.userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] }),
  })

  const cancelConnectionMutation = useMutation({
    mutationFn: (requestId: string) => networkingApi.cancelConnectionRequest(requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] }),
  })

  const acceptConnectionMutation = useMutation({
    mutationFn: (requestId: string) => networkingApi.acceptConnectionRequest(requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] }),
  })

  const rejectConnectionMutation = useMutation({
    mutationFn: (requestId: string) => networkingApi.rejectConnectionRequest(requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] }),
  })

  const removeConnectionMutation = useMutation({
    mutationFn: () => networkingApi.removeConnection(profile.userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] }),
  })

  const blockMutation = useMutation({
    mutationFn: () => networkingApi.blockUser(profile.userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] }),
  })

  const unblockMutation = useMutation({
    mutationFn: () => networkingApi.unblockUser(profile.userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] }),
  })

  // --- File upload handlers ---

  const handleCoverUpload = useCallback(() => {
    coverInputRef.current?.click()
  }, [])

  const handleAvatarUpload = useCallback(() => {
    avatarInputRef.current?.click()
  }, [])

  const onCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadCoverMutation.mutate(file)
    }
    // Reset so the same file can be selected again
    e.target.value = ''
  }

  const onAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadAvatarMutation.mutate(file)
    }
    e.target.value = ''
  }

  const handleMessageUser = async () => {
    try {
      const conversation = await (await import('../../api/messaging')).messagingApi.createConversation(profile.userId)
      navigate({ to: '/messages/$conversationId', params: { conversationId: conversation.id } })
    } catch {
      // Silently fail — user may not be able to message this person
    }
  }

  // --- Determine action buttons ---

  const isActionPending =
    followMutation.isPending || unfollowMutation.isPending ||
    sendConnectionMutation.isPending || cancelConnectionMutation.isPending ||
    acceptConnectionMutation.isPending || rejectConnectionMutation.isPending ||
    removeConnectionMutation.isPending || blockMutation.isPending || unblockMutation.isPending

  const renderNetworkingActions = () => {
    if (!relationship) return null

    // If blocked by me
    if (relationship.isBlockedByMe) {
      return (
        <button
          onClick={() => unblockMutation.mutate()}
          disabled={isActionPending}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-muted hover:shadow-md disabled:opacity-50"
        >
          <Ban className="h-4 w-4" />
          Unblock
        </button>
      )
    }

    const buttons: React.ReactNode[] = []

    // Connection action
    switch (relationship.connectionStatus) {
      case 'CONNECTED':
        buttons.push(
          <button
            key="connected"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="flex items-center gap-2 rounded-full border border-border bg-surface-muted px-5 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-muted/80 hover:shadow-md"
          >
            <UserCheck className="h-4 w-4 text-success" />
            Connected
          </button>
        )
        break
      case 'PENDING_SENT':
        buttons.push(
          <button
            key="pending-sent"
            onClick={() => relationship.pendingRequestId && cancelConnectionMutation.mutate(relationship.pendingRequestId)}
            disabled={isActionPending}
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-muted hover:text-danger hover:shadow-md disabled:opacity-50 group"
          >
            <Clock className="h-4 w-4 group-hover:hidden" />
            <UserX className="h-4 w-4 hidden group-hover:block" />
            <span className="group-hover:hidden">Pending</span>
            <span className="hidden group-hover:block">Cancel</span>
          </button>
        )
        break
      case 'PENDING_RECEIVED':
        buttons.push(
          <button
            key="accept"
            onClick={() => relationship.pendingRequestId && acceptConnectionMutation.mutate(relationship.pendingRequestId)}
            disabled={isActionPending}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg disabled:opacity-50"
          >
            <UserCheck className="h-4 w-4" />
            Accept
          </button>,
          <button
            key="reject"
            onClick={() => relationship.pendingRequestId && rejectConnectionMutation.mutate(relationship.pendingRequestId)}
            disabled={isActionPending}
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-muted hover:text-danger hover:shadow-md disabled:opacity-50"
          >
            <UserX className="h-4 w-4" />
          </button>
        )
        break
      case 'NONE':
      default:
        buttons.push(
          <button
            key="connect"
            onClick={() => sendConnectionMutation.mutate()}
            disabled={isActionPending}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
          >
            <UserPlus className="h-4 w-4" />
            Connect
          </button>
        )
        break
    }

    // Follow/Unfollow
    if (relationship.connectionStatus !== 'CONNECTED') {
      if (relationship.isFollowing) {
        buttons.push(
          <button
            key="unfollow"
            onClick={() => unfollowMutation.mutate()}
            disabled={isActionPending}
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold text-foreground-muted shadow-sm transition-all duration-200 hover:bg-surface-muted hover:text-danger hover:shadow-md disabled:opacity-50 group"
          >
            <span className="group-hover:hidden">Following</span>
            <span className="hidden group-hover:inline">Unfollow</span>
          </button>
        )
      } else {
        buttons.push(
          <button
            key="follow"
            onClick={() => followMutation.mutate()}
            disabled={isActionPending}
            className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-5 py-2 text-sm font-semibold text-primary shadow-sm transition-all duration-200 hover:bg-primary/10 hover:shadow-md disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Follow
          </button>
        )
      }
    }

    // Message button (only for connected users or anyone)
    buttons.push(
      <button
        key="message"
        onClick={handleMessageUser}
        className="flex items-center justify-center rounded-full border border-border bg-surface p-2.5 text-foreground shadow-sm transition-all duration-200 hover:bg-surface-muted hover:shadow-md hover:text-primary"
        title="Send message"
      >
        <MessageSquare className="h-4 w-4" />
      </button>
    )

    // More menu (block)
    buttons.push(
      <div key="more" className="relative">
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="flex items-center justify-center rounded-full border border-border bg-surface p-2.5 text-foreground-muted shadow-sm transition-all duration-200 hover:bg-surface-muted hover:shadow-md hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {showMoreMenu && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-surface-elevated shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {relationship.connectionStatus === 'CONNECTED' && (
              <button
                onClick={() => { removeConnectionMutation.mutate(); setShowMoreMenu(false) }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <UserX className="h-4 w-4" />
                Remove Connection
              </button>
            )}
            <button
              onClick={() => { blockMutation.mutate(); setShowMoreMenu(false) }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
            >
              <Ban className="h-4 w-4" />
              Block User
            </button>
          </div>
        )}
      </div>
    )

    return <>{buttons}</>
  }

  return (
<<<<<<< HEAD
    <div className="relative flex flex-col overflow-hidden rounded-none sm:rounded-2xl border-b sm:border border-border bg-surface-elevated shadow-sm transition-all duration-300">
=======
    <div className="relative flex flex-col rounded-none sm:rounded-xl border-b sm:border border-border bg-surface-elevated shadow-none sm:shadow-sm dark:shadow-none transition-colors overflow-hidden">
>>>>>>> e760939bc2c945b2a23bfecf6cdf06437713a9e8
      {/* Hidden file inputs */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onCoverFileChange}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onAvatarFileChange}
      />

      {/* Cover Image */}
      <div className="group relative h-40 w-full bg-surface-muted sm:h-56 overflow-hidden">
        {profile.coverUrl ? (
          <img src={profile.coverUrl} alt="Cover" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-gradient-to-tr from-primary/10 via-surface-muted to-accent/10 dark:from-primary/20 dark:to-accent/20" />
        )}
        {/* Subtle overlay to blend cover with background in dark mode */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-elevated/20 dark:to-surface-elevated/80 pointer-events-none" />
        
        {isOwnProfile && (
          <button 
            onClick={handleCoverUpload}
            disabled={uploadCoverMutation.isPending}
            className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white/90 opacity-0 backdrop-blur-md transition-all duration-200 hover:bg-black/60 hover:text-white group-hover:opacity-100 disabled:opacity-50"
            aria-label="Change cover photo"
          >
            <Upload className="h-4 w-4" />
          </button>
        )}
        {uploadCoverMutation.isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-200">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      {/* Avatar & Info */}
      <div className="relative px-5 pb-8 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          {/* Avatar */}
          <div className="group relative -mt-16 sm:-mt-20 shrink-0">
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-[5px] border-surface-elevated bg-surface shadow-md sm:h-40 sm:w-40 transition-transform duration-300">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
              ) : (
                <User className="h-16 w-16 text-foreground-muted/50 sm:h-20 sm:w-20" />
              )}
            </div>
            {isOwnProfile && (
              <button 
                onClick={handleAvatarUpload}
                disabled={uploadAvatarMutation.isPending}
                className="absolute bottom-2 right-2 rounded-full border-2 border-surface-elevated bg-surface p-2.5 text-foreground-muted shadow-md transition-all duration-200 hover:text-foreground hover:scale-105 disabled:opacity-50"
                aria-label="Change profile photo"
              >
                <Upload className="h-4 w-4" />
              </button>
            )}
            {uploadAvatarMutation.isPending && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm m-[5px]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap items-center mt-2 sm:mt-0 sm:pb-2">
            {isOwnProfile ? (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:bg-surface-muted hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Edit2 className="h-4 w-4" />
                <span className="inline">Edit Profile</span>
              </button>
            ) : (
              renderNetworkingActions()
            )}
          </div>
        </div>

<<<<<<< HEAD
        <div className="mt-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-none">
            {profile.displayName || profile.fullName}
          </h1>
          <p className="text-base text-foreground-muted font-medium mt-1">@{profile.username}</p>
=======
        <div className="mt-4">
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight leading-tight">{profile.displayName || profile.fullName}</h1>
          <p className="text-sm sm:text-base text-foreground-muted font-medium mt-0.5">@{profile.username}</p>
          
          {/* @ts-ignore - bio might not be typed but we render if it exists */}
          {profile.bio && (
            <p className="mt-3 text-sm sm:text-base text-foreground leading-relaxed">{profile.bio}</p>
          )}
>>>>>>> e760939bc2c945b2a23bfecf6cdf06437713a9e8
          
          {/* @ts-ignore - bio might not be typed but we render if it exists */}
          {profile.bio && (
            <p className="mt-4 text-base text-foreground leading-relaxed max-w-3xl">{profile.bio}</p>
          )}
          
          {(profile.department || profile.batch || profile.batchYear) && (
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-foreground-muted font-medium">
              {profile.department && (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary/80" />
                  {profile.department}
                </span>
              )}
              {(profile.batch || profile.batchYear) && (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent/80" />
                  Class of {profile.batch || profile.batchYear}
                </span>
              )}
            </div>
          )}

          {/* Relationship info badges */}
          {!isOwnProfile && relationship && !relationship.isBlockedByMe && (
            <div className="mt-3 flex flex-wrap gap-2">
              {relationship.isFollowedBy && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Follows you
                </span>
              )}
              {relationship.connectionStatus === 'CONNECTED' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  <UserCheck className="h-3 w-3" />
                  Connected
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isEditModalOpen && (
        <EditProfileModal 
          profile={profile} 
          onClose={() => setIsEditModalOpen(false)} 
        />
      )}
    </div>
  )
}
