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
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
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
            className="flex items-center gap-2 rounded-lg bg-surface-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted/80"
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
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            <Clock className="h-4 w-4" />
            Pending
          </button>
        )
        break
      case 'PENDING_RECEIVED':
        buttons.push(
          <button
            key="accept"
            onClick={() => relationship.pendingRequestId && acceptConnectionMutation.mutate(relationship.pendingRequestId)}
            disabled={isActionPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <UserCheck className="h-4 w-4" />
            Accept
          </button>,
          <button
            key="reject"
            onClick={() => relationship.pendingRequestId && rejectConnectionMutation.mutate(relationship.pendingRequestId)}
            disabled={isActionPending}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
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
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
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
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-danger disabled:opacity-50"
          >
            Following
          </button>
        )
      } else {
        buttons.push(
          <button
            key="follow"
            onClick={() => followMutation.mutate()}
            disabled={isActionPending}
            className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
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
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
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
          className="rounded-lg border border-border bg-surface p-2 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {showMoreMenu && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-surface-elevated shadow-lg z-50">
            {relationship.connectionStatus === 'CONNECTED' && (
              <button
                onClick={() => { removeConnectionMutation.mutate(); setShowMoreMenu(false) }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              >
                <UserX className="h-4 w-4" />
                Remove Connection
              </button>
            )}
            <button
              onClick={() => { blockMutation.mutate(); setShowMoreMenu(false) }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-surface-muted"
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
    <div className="relative flex flex-col rounded-none sm:rounded-xl border-b sm:border border-border bg-surface-elevated shadow-none sm:shadow-sm dark:shadow-none transition-colors overflow-hidden">
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
      <div className="group relative h-32 w-full bg-surface-muted sm:h-48">
        {profile.coverUrl ? (
          <img src={profile.coverUrl} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-primary/20 to-accent/20" />
        )}
        {isOwnProfile && (
          <button 
            onClick={handleCoverUpload}
            disabled={uploadCoverMutation.isPending}
            className="absolute right-4 top-4 rounded-md bg-black/50 p-2 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 group-hover:opacity-100 disabled:opacity-50"
            aria-label="Change cover photo"
          >
            <Upload className="h-4 w-4" />
          </button>
        )}
        {uploadCoverMutation.isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      {/* Avatar & Info */}
      <div className="relative px-4 pb-6 sm:px-6">
        <div className="flex justify-between items-start">
          {/* Avatar */}
          <div className="group relative -mt-12 sm:-mt-16">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-surface-elevated bg-surface-muted sm:h-32 sm:w-32">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
              ) : (
                <User className="h-12 w-12 text-foreground-muted sm:h-16 sm:w-16" />
              )}
            </div>
            {isOwnProfile && (
              <button 
                onClick={handleAvatarUpload}
                disabled={uploadAvatarMutation.isPending}
                className="absolute bottom-0 right-0 rounded-full border-2 border-surface-elevated bg-surface p-2 text-foreground-muted shadow-sm transition-colors hover:text-foreground disabled:opacity-50"
                aria-label="Change profile photo"
              >
                <Upload className="h-4 w-4" />
              </button>
            )}
            {uploadAvatarMutation.isPending && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2 flex-wrap justify-end">
            {isOwnProfile ? (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Edit2 className="h-4 w-4" />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
            ) : (
              renderNetworkingActions()
            )}
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight leading-tight">{profile.displayName || profile.fullName}</h1>
          <p className="text-sm sm:text-base text-foreground-muted font-medium mt-0.5">@{profile.username}</p>
          
          {/* @ts-ignore - bio might not be typed but we render if it exists */}
          {profile.bio && (
            <p className="mt-3 text-sm sm:text-base text-foreground leading-relaxed">{profile.bio}</p>
          )}
          
          {(profile.department || profile.batch) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground-muted">
              {profile.department && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {profile.department}
                </span>
              )}
              {profile.batch && (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Class of {profile.batch}
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
