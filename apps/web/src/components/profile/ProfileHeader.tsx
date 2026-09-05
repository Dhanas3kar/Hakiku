import type { UserProfile } from '../../api/profile'
import { profileApi } from '../../api/profile'
import { networkingApi } from '../../api/networking'
import type { RelationshipStatus } from '../../api/networking'
import { User, Edit2, Upload, UserPlus, UserCheck, UserX, Clock, Ban, MoreHorizontal, MessageSquare, Globe, ExternalLink } from 'lucide-react'
import { useState, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { EditProfileModal } from './EditProfileModal'
import { FollowersModal } from './FollowersModal'
import { VerifiedBadge } from '../ui/VerifiedBadge'
import { FormattedContent } from '../ui/FormattedContent'
import { isUserVerified } from '@/utils/user'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/useAuth'

interface Props {
  profile: UserProfile
  isOwnProfile: boolean
}

export function ProfileHeader({ profile, isOwnProfile }: Props) {
  const { user: currentUser } = useAuth()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [followersModalState, setFollowersModalState] = useState<{
    isOpen: boolean
    tab: 'followers' | 'following'
  }>({
    isOpen: false,
    tab: 'followers',
  })
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
  })

  const isAdminAccount =
    profile.isVerifiedIdentity ||
    profile.role === 'ADMIN' ||
    profile.username?.toLowerCase() === 'hakiku_official' ||
    profile.username?.toLowerCase().includes('hakiku')

  const isMessagingAllowed =
    relationship?.connectionStatus === 'CONNECTED' ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'MODERATOR' ||
    profile.role === 'ADMIN' ||
    profile.role === 'MODERATOR' ||
    isAdminAccount

  // Followers & Following counts
  const { data: followersData } = useQuery({
    queryKey: ['followers', profile.userId],
    queryFn: () => networkingApi.getFollowers(profile.userId, { limit: 1 }),
    staleTime: 60 * 1000,
    enabled: !!profile.userId,
  })

  const { data: followingData } = useQuery({
    queryKey: ['following', profile.userId],
    queryFn: () => networkingApi.getFollowing(profile.userId, { limit: 1 }),
    staleTime: 60 * 1000,
    enabled: !!profile.userId,
  })

  const followersCount = profile.followersCount ?? (followersData as any)?.pagination?.total ?? (followersData as any)?.data?.length ?? 0
  const followingCount = profile.followingCount ?? (followingData as any)?.pagination?.total ?? (followingData as any)?.data?.length ?? 0

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] })
      queryClient.invalidateQueries({ queryKey: ['followers', profile.userId] })
    },
  })

  const unfollowMutation = useMutation({
    mutationFn: () => networkingApi.unfollowUser(profile.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] })
      queryClient.invalidateQueries({ queryKey: ['followers', profile.userId] })
    },
  })

  const sendConnectionMutation = useMutation({
    mutationFn: () => networkingApi.sendConnectionRequest(profile.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] })
    },
  })

  const cancelConnectionMutation = useMutation({
    mutationFn: (requestId: string) => networkingApi.cancelConnectionRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] })
    },
  })

  const acceptConnectionMutation = useMutation({
    mutationFn: (requestId: string) => networkingApi.acceptConnectionRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] })
    },
  })

  const rejectConnectionMutation = useMutation({
    mutationFn: (requestId: string) => networkingApi.rejectConnectionRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] })
    },
  })

  const removeConnectionMutation = useMutation({
    mutationFn: () => networkingApi.removeConnection(profile.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] })
    },
  })

  const blockMutation = useMutation({
    mutationFn: () => networkingApi.blockUser(profile.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] })
    },
  })

  const unblockMutation = useMutation({
    mutationFn: () => networkingApi.unblockUser(profile.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', profile.userId] })
    },
  })

  // --- Handlers ---

  const handleAvatarUpload = useCallback(() => {
    avatarInputRef.current?.click()
  }, [])

  const handleCoverUpload = useCallback(() => {
    coverInputRef.current?.click()
  }, [])

  const onCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadCoverMutation.mutate(file)
    }
    e.target.value = ''
  }

  const onAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadAvatarMutation.mutate(file)
    }
    e.target.value = ''
  }

  const handleMessageUser = () => {
    navigate({
      to: '/messages',
      search: { targetUserId: profile.userId },
    })
  }

  // --- Determine action buttons ---

  const isActionPending =
    sendConnectionMutation.isPending ||
    acceptConnectionMutation.isPending ||
    rejectConnectionMutation.isPending ||
    cancelConnectionMutation.isPending ||
    followMutation.isPending ||
    unfollowMutation.isPending ||
    blockMutation.isPending || 
    unblockMutation.isPending ||
    removeConnectionMutation.isPending

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

    // Connection button based on status (Suppressed for official admin accounts)
    if (!isAdminAccount) {
      switch (relationship.connectionStatus) {
        case 'CONNECTED':
          buttons.push(
            <button
              key="connection"
              disabled
              className="flex shrink-0 items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-success dark:text-success-foreground focus-visible:outline-none"
            >
              <UserCheck className="h-4 w-4" />
              Connected
            </button>
          )
          break
        case 'PENDING_SENT':
          buttons.push(
            <button
              key="connection"
              onClick={() => relationship.pendingRequestId && cancelConnectionMutation.mutate(relationship.pendingRequestId)}
              disabled={isActionPending}
              className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-foreground-muted hover:bg-surface-muted hover:text-danger transition-colors disabled:opacity-50 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Clock className="h-4 w-4 group-hover:hidden" />
              <UserX className="h-4 w-4 hidden group-hover:block" />
              <span className="group-hover:hidden">Pending</span>
              <span className="hidden group-hover:inline">Cancel Request</span>
            </button>
          )
          break
        case 'PENDING_RECEIVED':
          buttons.push(
            <div key="connection" className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => relationship.pendingRequestId && acceptConnectionMutation.mutate(relationship.pendingRequestId)}
                disabled={isActionPending}
                className="flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <UserCheck className="h-4 w-4" />
                Accept
              </button>
              <button
                onClick={() => relationship.pendingRequestId && rejectConnectionMutation.mutate(relationship.pendingRequestId)}
                disabled={isActionPending}
                className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-foreground-muted hover:bg-surface-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <UserX className="h-4 w-4" />
                Ignore
              </button>
            </div>
          )
          break
        case 'NONE':
        default:
          if (!relationship.isFollowedBy) {
            buttons.push(
              <button
                key="connection"
                onClick={() => sendConnectionMutation.mutate()}
                disabled={isActionPending}
                className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <UserPlus className="h-4 w-4" />
                Connect
              </button>
            )
          }
          break
      }
    }

    // Follow/Unfollow (Always enabled for Admin handles or non-connected users)
    if (isAdminAccount || relationship.connectionStatus !== 'CONNECTED') {
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
    if (isMessagingAllowed) {
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
    } else {
      buttons.push(
        <button
          key="message"
          onClick={() => toast.error('You can only message users you are connected with. Send a connection request first!')}
          className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface-muted/40 px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-foreground-muted opacity-65 transition-colors focus-visible:outline-none"
          title="Connect to send messages"
        >
          <MessageSquare className="h-4 w-4 hidden sm:block" />
          Message
        </button>
      )
    }

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
            {currentUser?.role === 'ADMIN' && (
              <button
                onClick={async () => {
                  setShowMoreMenu(false)
                  const isSuspended = profile.status === 'SUSPENDED' || profile.status === 'BANNED'
                  const newStatus = isSuspended ? 'ACTIVE' : 'SUSPENDED'
                  try {
                    await (await import('@/api/client')).client.patch(`/admin/users/${profile.userId}/status`, {
                      status: newStatus,
                      reason: isSuspended ? 'Admin revoked suspension' : 'Admin suspended for terms violation',
                    })
                    toast.success(isSuspended ? 'Account restored successfully' : 'Account suspended successfully')
                    queryClient.invalidateQueries({ queryKey: ['profile', profile.username] })
                  } catch (e: any) {
                    toast.error(e?.response?.data?.message || 'Failed to update account status')
                  }
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-danger border-t border-border transition-colors hover:bg-danger/10"
              >
                <Ban className="h-4 w-4" />
                {profile.status === 'SUSPENDED' || profile.status === 'BANNED' ? 'Revoke Suspension' : 'Suspend Account (Admin)'}
              </button>
            )}
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
        
        {/* Subtle bottom gradient */}
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

          {/* Actions Area */}
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
            {isUserVerified(profile) && (
              <VerifiedBadge className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 ml-1" />
            )}
          </h1>
          <p className="text-base text-foreground-muted mt-0.5">@{profile.username}</p>
          
          {/* Followers & Following Count */}
          <div className="mt-3 flex items-center gap-4 text-sm font-medium">
            <button
              onClick={() => setFollowersModalState({ isOpen: true, tab: 'followers' })}
              className="flex items-center gap-1.5 text-foreground hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
            >
              <span className="font-bold text-foreground">{followersCount}</span>
              <span className="text-foreground-muted hover:text-primary transition-colors">Followers</span>
            </button>
            <span className="text-border">•</span>
            <button
              onClick={() => setFollowersModalState({ isOpen: true, tab: 'following' })}
              className="flex items-center gap-1.5 text-foreground hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
            >
              <span className="font-bold text-foreground">{followingCount}</span>
              <span className="text-foreground-muted hover:text-primary transition-colors">Following</span>
            </button>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-3 text-base text-foreground leading-relaxed break-words">
              <FormattedContent content={profile.bio} />
            </div>
          )}

          {/* Social Links */}
          {profile.socialLinks && Object.values(profile.socialLinks).some(url => url && typeof url === 'string' && url.trim().length > 0) && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {Object.entries(profile.socialLinks).map(([key, rawUrl]) => {
                if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) return null
                const trimmed = rawUrl.trim()
                const href = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`
                const label = key.charAt(0).toUpperCase() + key.slice(1)

                return (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted/70 px-3 py-1 text-xs font-medium text-foreground hover:bg-surface-muted hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{label}</span>
                    <ExternalLink className="h-3 w-3 text-foreground-muted shrink-0" />
                  </a>
                )
              })}
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

      {followersModalState.isOpen && (
        <FollowersModal
          userId={profile.userId}
          initialTab={followersModalState.tab}
          followersCount={followersCount}
          followingCount={followingCount}
          onClose={() => setFollowersModalState((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  )
}
