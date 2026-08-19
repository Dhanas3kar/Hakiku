# Product QA & Release Validation Plan

This phase shifts focus from architectural resilience (where we proved the application does not crash under expected failures) to functional correctness, user experience, and production readiness. Feature development is explicitly frozen. 

## Goal
Prove that SRM Connect works end-to-end under real user conditions without encountering unhandled application errors, security leaks, or broken workflows.

> [!IMPORTANT]
> **No expected application-level failure should crash the application shell.**
> We are testing to ensure the app behaves predictably. Real-world browser crashes or OS out-of-memory errors are outside the scope of React error boundaries.

## Proposed Changes

### [New] Global Toast System
The crude `alert()` calls for optimistic mutation failures will be replaced with a professional, accessible toast system.

#### [NEW] `sonner` Integration
- Install `sonner` to `apps/web`.
- Add `<Toaster />` to `Providers.tsx` or `__root.tsx`.
- Replace `alert(err.message)` in `PostCard.tsx`, `CommentsSection.tsx`, and `PollCard.tsx` with `toast.error(err.message)`.

---

## Verification Plan (The QA Matrix)

The core of this phase is manual and automated verification across the following dimensions:

### 1. Automated Validation (Build & Tests)
We will execute the following in a clean environment (no debug logs, no chaos interceptors, no mocked endpoints):
- `npm run typecheck` (Frontend & Backend)
- `npm run build` (Frontend & Backend)
- `npm run test` (Backend Unit Tests)
- `npm run test:e2e` (Backend E2E Tests)

### 2. User Journey Testing (Manual)
We will spawn a browser subagent (or perform manual tests) for the following core flows:
- **Onboarding:** Register → Verify OTP → Login → Complete Profile
- **Content Lifecycle:** Create Post → Edit Post → Delete Post
- **Engagement:** Like ↔ Unlike, Comment → Delete Comment, Poll → Vote
- **Social:** Follow → Connect → Message User
- **Moderation:** Confession → Report

### 3. Two-User Concurrency Testing
- **Real-time Comms:** User A ↔ User B messaging (verifying typing indicators and read receipts).
- **Notifications:** Verifying notification delivery and "mark as read" state syncing.
- **Privacy Rules:** Validating post visibility (Public vs. Connections-only).

### 4. Mobile-First & UI Validation
- Test rendering at 320px–375px widths.
- Ensure touch targets are adequately sized.
- Keyboard navigation and modal trap behaviors.
- Verify infinite scrolling without jank.
- Chat navigation on small screens.

### 5. Security & Authorization Boundaries
- **IDOR Attempts:** Attempt to access or modify resources belonging to another user.
- **Blocked Users:** Verify blocked user access restrictions.
- **Private Posts:** Attempt to view connections-only posts from a non-connected account.
- **Session:** Verify refresh-token rotation and strict session invalidation upon logout.
- **Rate Limits:** Validate 429 backoff handling.

## User Review Required

> [!TIP]
> Are you okay with using `sonner` for the Toast system, or would you prefer a custom Tailwind-only implementation without additional dependencies?

> [!NOTE]
> For the **Two-User Concurrency Testing** and **Mobile-First Validation**, I will use the browser subagent to orchestrate these checks where possible. Are there any specific test accounts (e.g. `test1@example.com`) you would like me to use?
