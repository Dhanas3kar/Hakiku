# Phase 20: Admin Route Access Bug Fix

**Date:** 2026-08-20
**Status:** BLOCKED → FIX IN PROGRESS → VERIFIED PENDING MANUAL TEST

## Issue Summary
The official ConnectX Admin Control Center was built, but navigating to `/admin` immediately redirected to `/` for all users, including the configured ConnectX admin identity.

## Root Cause
The root cause was a mismatch in the payload schema between the frontend and the backend regarding the user's role.

1. **Frontend Route Guard:** In `_authenticated.admin.tsx`, the frontend used `useAuth()` to check if `user?.role !== 'ADMIN'`. If true, it redirected to `/`.
2. **Backend Profile Endpoint:** `useAuth()` hydrates the user session by calling `GET /profile/me`, which routed to `ProfileService.getMyProfile()`.
3. **Database Schema Isolation:** In the database, the `role` column lives securely in the `users` table, not the `profiles` table. The `getMyProfile()` method previously only queried the `profiles` table.
4. **Result:** The returned profile payload lacked the `role` entirely. On the frontend, `user.role` was evaluated as `undefined`. Since `undefined !== 'ADMIN'` is `true`, the redirect was triggered immediately.

## Exact Fix & Files Changed

### 1. `apps/api/src/profile/services/profile.service.ts`
- Modified `getMyProfile()` to explicitly fetch the authenticated user's `role` from the `users` table and inject it into the returned profile object.
- **Note on Exposure:** Only `getMyProfile()` was modified. Other public profile endpoints (e.g., `getProfileByUsername`) were left untouched to prevent unnecessary exposure of administrative roles on public-facing profiles.

### 2. `apps/web/src/api/profile.ts`
- Updated the `UserProfile` TypeScript interface to include `role?: 'STUDENT' | 'MODERATOR' | 'ADMIN'`.

## Security Implications & Verification
- **No Boundary Weakening:** The frontend route guard was not weakened. The backend `RolesGuard` was not touched. 
- **Backend Authority:** The actual security boundary remains the backend `RolesGuard`, which correctly extracts the `ADMIN` role from the JWT verified during login.
- **ConnectX Identity:** The `CONNECTX_ADMIN_EMAIL` environment variable remains the sole authoritative source for granting the `ADMIN` role during login and OTP verification.

## Validation Results
- `npm run typecheck` - Passed
- `npm run lint` - Passed
- `npm run build` - Passed successfully for both `apps/api` and `apps/web`

## Final Verdict & Next Steps
The data-flow issue has been patched securely. The frontend now correctly receives the authenticated user's role, allowing the route guard to differentiate between a student and an admin.

**Decisive Manual Test Required:**
| Account | `/admin` | Admin API |
| :--- | :--- | :--- |
| **ConnectX** | ✅ Loads | ✅ Allowed |
| **Student** | ❌ Redirects | ❌ 403 Forbidden |
| **Unauthenticated** | ❌ Auth flow | ❌ 401 Unauthorized |

Once the manual test matrix passes, Phase 20 can be officially marked as closed.
