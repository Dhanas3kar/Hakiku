/**
 * Checks if a user should display the official Verified Badge.
 * Returns true if:
 * 1. user.isVerifiedIdentity or user.isVerified is true
 * 2. user.role or user.systemRole is 'ADMIN' or 'MODERATOR'
 * 3. user.username or displayName matches/contains official handles ('admin', 'hakiku', 'official', 'srmconnect')
 */
export function isUserVerified(user?: {
  username?: string | null
  displayName?: string | null
  fullName?: string | null
  isVerifiedIdentity?: boolean | null
  isVerified?: boolean | null
  role?: string | null
  systemRole?: string | null
  communityRole?: string | null
}): boolean {
  if (!user) return false
  if (user.isVerifiedIdentity || user.isVerified) return true
  if (
    user.role === 'ADMIN' ||
    user.role === 'MODERATOR' ||
    user.systemRole === 'ADMIN' ||
    user.communityRole === 'OWNER'
  ) {
    return true
  }

  const username = (user.username || '').toLowerCase().trim()
  const name = (user.displayName || user.fullName || '').toLowerCase().trim()

  if (
    username === 'admin' ||
    username.includes('admin') ||
    username.includes('hakiku') ||
    username.includes('official') ||
    username.includes('srmconnect') ||
    name.includes('admin') ||
    name.includes('official')
  ) {
    return true
  }

  return false
}

