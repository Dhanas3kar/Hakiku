import type { UserProfile } from '../../api/profile'
import { profileApi } from '../../api/profile'
import { networkingApi } from '../../api/networking'
import type { RelationshipStatus } from '../../api/networking'
import { User, Edit2, Upload, UserPlus, UserCheck, UserX, Clock, Ban, MoreHorizontal, MessageSquare, Globe, Briefcase, ExternalLink } from 'lucide-react'
import { useState, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { EditProfileModal } from './EditProfileModal'
import { VerifiedBadge } from '../ui/VerifiedBadge'

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
          className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-foreground hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-foreground hover:bg-surface-muted hover:text-danger hover:border-danger/30 transition-colors disabled:opacity-50 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
            className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <UserCheck className="h-4 w-4" />
            Accept
          </button>,
          <button
            key="reject"
            onClick={() => relationship.pendingRequestId && rejectConnectionMutation.mutate(relationship.pendingRequestId)}
            disabled={isActionPending}
            className="flex shrink-0 items-center justify-center rounded-full border border-border bg-surface h-8 w-8 sm:h-9 sm:w-9 text-foreground hover:bg-surface-muted hover:text-danger hover:border-danger/30 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            title="Reject connection"
          >
            <UserX className="h-4 w-4" />
          </button>
        )
        break
      case 'NONE':
      default:
        // Do not allow sending connection requests to verified official accounts
        if (!profile.isVerifiedIdentity) {
          buttons.push(
            <button
              key="connect"
              onClick={() => sendConnectionMutation.mutate()}
              disabled={isActionPending}
              className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-1.5 sm:px-6 sm:py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <UserPlus className="h-4 w-4" />
              Connect
            </button>
          )
        }
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
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-foreground-muted hover:bg-surface-muted hover:text-danger transition-colors disabled:opacity-50 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-foreground hover:bg-surface-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <UserPlus className="h-4 w-4" />
            Follow
          </button>
        )
      }
    }

    // Message button
    buttons.push(
      <button
        key="message"
        onClick={handleMessageUser}
        className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-foreground hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        title="Send message"
      >
        <MessageSquare className="h-4 w-4 hidden sm:block" />
        Message
      </button>
    )

    // More menu (block)
    buttons.push(
      <div key="more" className="relative shrink-0">
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="flex items-center justify-center rounded-full border border-border bg-surface h-8 w-8 sm:h-9 sm:w-9 text-foreground hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="More options"
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
    <div className="relative flex flex-col bg-surface border-b sm:border border-border sm:rounded-xl shadow-none overflow-hidden sm:shadow-sm">
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

      {/* Cover Image Container */}
      <div className="group relative w-full h-32 sm:h-48 md:h-56 bg-surface-muted overflow-hidden flex-shrink-0">
        {profile.coverUrl ? (
          <img 
            src={profile.coverUrl} 
            alt="Cover" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]" 
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-surface-muted to-accent/10 dark:from-primary/15 dark:via-surface/50 dark:to-accent/15" />
        )}
        
        {/* Subtle bottom gradient to ensure avatar pops against cover */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        
        {isOwnProfile && (
          <button 
            onClick={handleCoverUpload}
            disabled={uploadCoverMutation.isPending}
            className="absolute right-4 top-4 flex items-center justify-center h-8 w-8 rounded-full bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity duration-200 hover:bg-black/60 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
            aria-label="Change cover photo"
          >
            <Upload className="h-4 w-4" />
          </button>
        )}
        {uploadCoverMutation.isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Profile Content Container */}
      <div className="px-5 sm:px-8 pb-8 relative">
        {/* Top Row: Avatar & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          
          {/* Avatar Area */}
          <div className="relative -mt-16 sm:-mt-20 lg:-mt-24 inline-block shrink-0">
            <div className="group relative">
              <div className="h-32 w-32 sm:h-40 sm:w-40 lg:h-48 lg:w-48 overflow-hidden rounded-full border-[4px] sm:border-[6px] border-surface bg-surface shadow-sm">
                {profile.avatarUrl ? (
                  <img 
                    src={profile.avatarUrl} 
                    alt={profile.displayName} 
                    className="h-full w-full object-cover bg-surface-muted" 
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-surface-muted">
                    <User className="h-1/2 w-1/2 text-foreground-muted/50" />
                  </div>
                )}
              </div>
              
              {isOwnProfile && (
                <button 
                  onClick={handleAvatarUpload}
                  disabled={uploadAvatarMutation.isPending}
                  className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 flex items-center justify-center h-9 w-9 rounded-full border-2 border-surface bg-surface-elevated text-foreground shadow-sm transition-transform hover:scale-105 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  aria-label="Change profile photo"
                >
                  <Upload className="h-4 w-4" />
                </button>
              )}
              {uploadAvatarMutation.isPending && (
                <div className="absolute inset-0 m-[4px] sm:m-[6px] rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                </div>
              )}
            </div>
          </div>

          {/* Actions Area — scrollable on mobile so buttons never wrap off-screen */}
          <div className="flex gap-2 items-center mt-2 sm:mt-0 sm:pb-4 lg:pb-6 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-nowrap sm:flex-wrap">
            {isOwnProfile ? (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold text-foreground hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Edit2 className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
            ) : (
              renderNetworkingActions()
            )}
          </div>
        </div>

        {/* Identity & Information Area */}
        <div className="mt-4 sm:mt-5 max-w-3xl">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
            {profile.displayName || profile.fullName}
            {profile.isVerifiedIdentity && (
              <VerifiedBadge className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 ml-1" />
            )}
          </h1>
          <p className="text-base text-foreground-muted mt-0.5">@{profile.username}</p>
          
          {/* Bio */}
          {/* @ts-ignore */}
          {profile.bio && (
            <p className="mt-4 text-base text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {profile.bio}
            </p>
          )}

          {/* Social Links */}
          {profile.socialLinks && Object.values(profile.socialLinks).some(val => val && val.trim() !== '') && (
            <div className="mt-4 flex flex-wrap gap-3">
              {profile.socialLinks.website && (
                <a href={profile.socialLinks.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-foreground-muted hover:text-primary transition-colors">
                  <ExternalLink className="h-4 w-4" />
                  Website
                </a>
              )}
              {profile.socialLinks.github && (
                <a href={profile.socialLinks.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-foreground-muted hover:text-primary transition-colors">
                  <Globe className="h-4 w-4" />
                  GitHub
                </a>
              )}
              {profile.socialLinks.linkedin && (
                <a href={profile.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-foreground-muted hover:text-primary transition-colors">
                  <Briefcase className="h-4 w-4" />
                  LinkedIn
                </a>
              )}
            </div>
          )}
          
          {/* Academic Metadata */}
          {(profile.department || profile.batch || profile.batchYear) && (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground-muted font-medium">
              {profile.department && (
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  {profile.department}
                </span>
              )}
              {(profile.batch || profile.batchYear) && (
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent/70" />
                  Class of {profile.batch || profile.batchYear}
                </span>
              )}
            </div>
          )}

          {/* Relationship Context */}
          {!isOwnProfile && relationship && !relationship.isBlockedByMe && (
            <div className="mt-4 flex flex-wrap gap-2">
              {relationship.isFollowedBy && (
                <span className="inline-flex items-center gap-1.5 rounded bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground-muted">
                  Follows you
                </span>
              )}
              {relationship.connectionStatus === 'CONNECTED' && (
                <span className="inline-flex items-center gap-1.5 rounded bg-success/10 px-2.5 py-1 text-xs font-medium text-success dark:text-success-foreground dark:bg-success/20">
                  <UserCheck className="h-3.5 w-3.5" />
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
