/**
 * Checks if a user should display the official Verified Badge.
 * Returns true if:
 * 1. user.isVerifiedIdentity is true
 * 2. user.role is 'ADMIN'
 * 3. user.username matches or contains 'hakiku' (case-insensitive)
 */
export function isUserVerified(user?: {
  username?: string | null
  displayName?: string | null
  fullName?: string | null
  isVerifiedIdentity?: boolean | null
  role?: string | null
}): boolean {
  if (!user) return false
  if (user.isVerifiedIdentity) return true
  if (user.role === 'ADMIN') return true

  const username = (user.username || '').toLowerCase().trim()
  if (!username) return false

  return (
    username === 'hakiku' ||
    username.startsWith('hakiku') ||
    username.endsWith('hakiku') ||
    username.includes('hakiku')
  )
}
