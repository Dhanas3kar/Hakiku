# SRM Connect — Feature Inventory & Contract Matrix

## Phase 1 Discovery: Complete

---

## Backend API Endpoints (from Controllers)

### Auth (`/auth`)
| Endpoint | Method | Backend | Frontend API | UI Route | Status |
|---|---|---|---|---|---|
| `/auth/send-otp` | POST | ✅ | ✅ `authApi.sendOtp` | `/login` | ✅ |
| `/auth/verify-otp` | POST | ✅ | ✅ `authApi.verifyOtp` | `/verify-otp` | ✅ |
| `/auth/refresh` | POST | ✅ | ✅ `client.ts` interceptor | Auto | ✅ |
| `/auth/logout` | POST | ✅ | ✅ `authApi.logout` | Settings/Sidebar | ✅ |
| `/auth/csrf` | GET | ✅ | ❌ Not called | — | ⚠️ CSRF unused |

### Profile (`/profile`)
| Endpoint | Method | Backend | Frontend API | UI Route | Status |
|---|---|---|---|---|---|
| `/profile/onboarding` | POST | ✅ | ✅ `profileApi.onboarding` | `/onboarding` | ✅ |
| `/profile/me` | GET | ✅ | ✅ `profileApi.getMe` | `useAuth` hook | ✅ |
| `/profile/me` | PATCH | ✅ | ✅ `profileApi.updateMe` | EditProfileModal | ✅ |
| `/profile/me/avatar` | POST | ✅ | ✅ `profileApi.uploadAvatar` | ProfileHeader | ⚠️ **STUB** — handler is empty |
| `/profile/me/cover` | POST | ✅ | ✅ `profileApi.uploadCover` | ProfileHeader | ⚠️ **STUB** — handler is empty |
| `/profile/search` | GET | ✅ | ❌ Not in frontend API | — | ❌ **DISCONNECTED** |
| `/profile/username/:username` | GET | ✅ | ✅ `profileApi.getByUsername` | Profile page | ✅ |
| `/profile/id/:userId` | GET | ✅ | ❌ Not in frontend API | — | ⚠️ Unused |
| `/profile/me/preferences` | GET | ❌ **Does not exist** | ✅ Settings calls it | Settings page | ❌ **BROKEN** — 404 |
| `/profile/me/preferences` | PATCH | ❌ **Does not exist** | ✅ Settings calls it | Settings page | ❌ **BROKEN** — 404 |

### Skills (`/skills`)
| Endpoint | Method | Backend | Frontend API | UI Route | Status |
|---|---|---|---|---|---|
| `/skills` | GET | ✅ | ❌ No frontend call | — | ❌ **DISCONNECTED** |
| `/skills` | POST | ✅ | ❌ No frontend call | — | ❌ **DISCONNECTED** |

### Interests (`/interests`)
| Endpoint | Method | Backend | Frontend API | UI Route | Status |
|---|---|---|---|---|---|
| `/interests` | GET | ✅ | ❌ No frontend call | — | ❌ **DISCONNECTED** |
| `/interests` | POST | ✅ | ❌ No frontend call | — | ❌ **DISCONNECTED** |

### Posts (`/posts`)
| Endpoint | Method | Backend | Frontend API | UI Route | Status |
|---|---|---|---|---|---|
| `/posts` | POST | ✅ | ✅ `postsApi.createPost` | PostComposer | ✅ |
| `/posts/media/upload` | POST | ✅ | ✅ `postsApi.uploadMedia` | PostComposer | ✅ |
| `/posts/:id` | GET | ✅ | ✅ `postsApi.getPost` | — | ✅ |
| `/posts/:id` | PATCH | ✅ | ✅ `postsApi.updatePost` | EditPostModal | ✅ |
| `/posts/:id` | DELETE | ✅ | ✅ `postsApi.deletePost` | PostCard | ✅ |
| `/posts/:id/like` | POST | ✅ | ✅ `postsApi.likePost` | PostCard | ✅ |
| `/posts/:id/like` | DELETE | ✅ | ✅ `postsApi.unlikePost` | PostCard | ✅ |
| `/posts/:id/comments` | POST | ✅ | ✅ `postsApi.createComment` | CommentsSection | ✅ |
| `/posts/:id/comments` | GET | ✅ | ✅ `postsApi.getComments` | CommentsSection | ⚠️ Response shape mismatch? |
| `/posts/comments/:id` | PATCH | ✅ | ✅ `postsApi.updateComment` | — | ✅ |
| `/posts/comments/:id` | DELETE | ✅ | ✅ `postsApi.deleteComment` | — | ✅ |
| `/posts/user/:userId` | GET | ✅ | ❌ Not in frontend API | Profile page | ❌ **DISCONNECTED** |

### Feed (`/feed`)
| Endpoint | Method | Backend | Frontend API | UI Route | Status |
|---|---|---|---|---|---|
| `/feed` | GET | ✅ | ✅ `feedApi.getPersonalizedFeed` | Home | ⚠️ Response shape? |
| `/feed/discover` | GET | ✅ | ✅ `feedApi.getDiscoveryFeed` | — | ⚠️ Not used in Discover page |

### Networking (`/networking`)
| Endpoint | Method | Backend | Frontend API | UI Route | Status |
|---|---|---|---|---|---|
| `/networking/follow/:targetUserId` | POST | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/follow/:targetUserId` | DELETE | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/followers/:userId` | GET | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/following/:userId` | GET | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/connections/request/:targetUserId` | POST | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/connections/accept/:requestId` | POST | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/connections/reject/:requestId` | POST | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/connections/request/:requestId` | DELETE | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/connections/:targetUserId` | DELETE | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/connections` | GET | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/connections/requests/pending` | GET | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/connections/requests/sent` | GET | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/block/:targetUserId` | POST | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/block/:targetUserId` | DELETE | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/blocks` | GET | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |
| `/networking/status/:targetUserId` | GET | ✅ | ❌ **No frontend API** | — | ❌ **DISCONNECTED** |

### Messaging (`/messages`)
| Endpoint | Method | Backend | Frontend API | UI Route | Status |
|---|---|---|---|---|---|
| `/messages/conversations` | POST | ✅ | ✅ | `/messages` | ✅ |
| `/messages/conversations` | GET | ✅ | ✅ | `/messages` | ✅ |
| `/messages/conversations/:id/messages` | POST | ✅ | ✅ | ChatWindow | ✅ |
| `/messages/conversations/:id/messages` | GET | ✅ | ✅ | ChatWindow | ⚠️ Response shape? |
| `/messages/:messageId` | PATCH | ✅ | ✅ | — | ✅ |
| `/messages/:messageId` | DELETE | ✅ | ✅ | — | ✅ |
| `/messages/conversations/:id/read` | POST | ✅ | ✅ | ChatWindow | ✅ |
| `/messages/unread-count` | GET | ✅ | ✅ | Sidebar badge | ✅ |
| `/messages/media/upload` | POST | ✅ | ✅ | — | ✅ |

### Notifications (`/notifications`)
| Endpoint | Method | Backend | Frontend API | UI Route | Status |
|---|---|---|---|---|---|
| `/notifications` | GET | ✅ | ✅ | `/notifications` | ⚠️ Response shape? |
| `/notifications/unread-count` | GET | ✅ | ✅ | Sidebar badge | ✅ |
| `/notifications/read-all` | PATCH | ✅ | ✅ | — | ✅ |
| `/notifications/:id/read` | PATCH | ✅ | ✅ | — | ✅ |
| `/notifications/:id` | DELETE | ✅ | ✅ | — | ✅ |
| `/notifications/preferences` | GET | ✅ | ✅ | — | ✅ |
| `/notifications/preferences/:category` | PATCH | ✅ | ✅ | — | ✅ |

### Community (`/community`)
| Endpoint | Method | Backend | Frontend API | UI Route | Status |
|---|---|---|---|---|---|
| `/community/confessions/hero` | GET | ✅ | ✅ | Home (ConfessionHero) | ✅ |
| `/community/confessions` | POST | ✅ | ✅ | ConfessionComposer | ✅ |
| `/community/confessions` | GET | ✅ | ✅ | ConfessionFeed | ✅ |
| `/community/confessions/:id` | DELETE | ✅ | ❌ Not in frontend API | — | ❌ **DISCONNECTED** |
| `/community/people/recommendations` | GET | ✅ | ✅ | PeopleWorthKnowing | ✅ |
| `/community/campus/pulse` | GET | ✅ | ✅ | CampusPulse | ✅ |
| `/community/campus/insights` | GET | ✅ | ✅ | CampusInsights | ✅ |
| `/community/polls` | POST | ✅ | ✅ | PollFeed | ✅ |
| `/community/polls` | GET | ✅ | ✅ | PollFeed | ✅ |
| `/community/polls/:id` | GET | ✅ | ✅ | — | ✅ |
| `/community/polls/:id/vote` | POST | ✅ | ✅ | PollCard | ✅ |
| `/community/polls/:id/vote` | DELETE | ✅ | ✅ | PollCard | ✅ |
| `/community/report` | POST | ✅ | ✅ | ReportDialog | ✅ |
| Moderation endpoints (5) | — | ✅ | ❌ No frontend UI | — | ❌ **No admin UI** |

---

## WebSocket Namespaces

| Namespace | Backend Gateway | Frontend Hook | Status |
|---|---|---|---|
| `/` (default) | `NotificationGateway` | `useSocket` → `notificationSocket` | ✅ Connected |
| `/messages` | `MessagingGateway` | `useSocket` → `messagingSocket` | ✅ Connected |

---

## Critical Issues Found (Ordered by Severity)

### 🔴 CRITICAL — Entire Feature Domain Disconnected

1. **Networking (Follow/Connect/Block) — ZERO frontend integration**
   - 16 backend endpoints fully implemented
   - No `networkingApi` exists in `apps/web/src/api/`
   - ProfileHeader has a hardcoded "Connect" button that does nothing
   - Profile page shows no follower/following/connection counts
   - No block UI anywhere
   - No connection request inbox

2. **User Posts on Profile — Not wired**
   - Backend: `GET /posts/user/:userId` exists
   - Frontend: Not called. Profile page shows no posts tab.

### 🟠 HIGH — Broken Feature (Frontend calls non-existent backend)

3. **Settings Preferences — 404 errors**
   - Settings page calls `GET /profile/me/preferences` and `PATCH /profile/me/preferences`
   - These endpoints DO NOT EXIST in the backend
   - Backend has notification preferences at `/notifications/preferences` — needs to rewire

4. **Profile Avatar/Cover Upload — Handler is a stub**
   - `handleCoverUpload` and `handleAvatarUpload` in `ProfileHeader.tsx` are empty functions
   - Backend endpoints exist and work. Frontend API methods exist. Just not wired in the component.

5. **Profile Search — Not exposed in frontend**
   - Backend `GET /profile/search` works with campus/department/batchYear/query filters
   - No search UI or API call exists in the frontend

### 🟡 MEDIUM — Response Shape Mismatches

6. **Comments response parsing** — Frontend expects `res.data` and `res.meta.nextCursor` but backend may return differently
7. **Feed response parsing** — Frontend expects `res.data` and `res.pagination.nextCursor`
8. **Notifications response parsing** — Frontend expects `res.data` and `res.meta`

### 🟢 LOW — Missing but non-critical

9. **Skills/Interests endpoints** — Backend has search/create, no frontend for onboarding or profile edit to use them
10. **Confession delete** — Backend supports `DELETE /community/confessions/:id`, no frontend call
11. **Moderation UI** — Backend has full moderation endpoints, no admin dashboard
12. **CSRF token** — `GET /auth/csrf` exists but is never called

---

## Execution Priority

| Priority | Issue | Action |
|---|---|---|
| 1 | Networking API + UI | Create `networkingApi`, wire ProfileHeader, add connection counts, request inbox |
| 2 | Settings preferences fix | Rewire to use `/notifications/preferences` endpoints |
| 3 | Profile avatar/cover upload | Wire the existing API into ProfileHeader button handlers |
| 4 | User posts on profile | Wire `GET /posts/user/:userId`, add posts tab to profile page |
| 5 | Profile search | Add search bar to Discover or Header |
| 6 | Response shape verification | Test each API call and fix any parsing mismatches |
| 7 | Skills/Interests in onboarding | Wire search/select into OnboardingForm and EditProfileModal |
| 8 | Confession delete | Wire into ConfessionFeed |
