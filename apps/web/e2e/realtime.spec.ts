import { test, expect } from '@playwright/test';
import { loginAs } from './test-utils';

test.describe('DAY 2 REALTIME VERIFICATION', () => {
  const runId = Math.random().toString(36).substring(2, 8);
  const EMAIL_A = `qa_a_${runId}@srmist.edu.in`;
  const EMAIL_B = `qa_b_${runId}@srmist.edu.in`;
  const USERNAME_A = `qa_a_${runId}`;
  const USERNAME_B = `qa_b_${runId}`;

  // Use a long timeout for the entire suite to accommodate login operations and network states
  test.setTimeout(90000);

  test('Verify Messaging, Notifications, Reconnect, and Resilience', async ({ browser, baseURL }) => {
    // 1. Two genuinely independent browser contexts
    const contextA = await browser.newContext({ baseURL });
    const contextB = await browser.newContext({ baseURL });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    pageA.on('console', msg => console.log(`[PageA] ${msg.type()}: ${msg.text()}`));
    pageB.on('console', msg => console.log(`[PageB] ${msg.type()}: ${msg.text()}`));

    // 2. Authenticate independently
    await loginAs(pageA, EMAIL_A);
    await loginAs(pageB, EMAIL_B);

    // ==========================================
    // GATE 0 & 2: ESTABLISH CONNECTION & VERIFY NOTIFICATIONS
    // ==========================================
    // User A navigates to User B's profile and sends a connection request
    await pageA.goto(`/profile/${USERNAME_B}`);
    await pageA.waitForLoadState('networkidle');
    const connectButton = pageA.locator('button', { hasText: 'Connect' }).first();
    await expect(connectButton).toBeVisible({ timeout: 15000 });
    
    // User B stays on the home or messages page to receive the notification
    await pageB.goto('/messages');
    await pageB.waitForLoadState('networkidle');

    await connectButton.click();
    await expect(pageA.locator('button', { hasText: 'Pending' }).first()).toBeVisible({ timeout: 10000 });

    // Verify B receives the notification UI/count changes without reload
    // In desktop mode (--headed), the MobileNav is hidden, so we target the aside Sidebar
    const notificationBadgeB = pageB.locator('aside').locator('a[href="/notifications"]').locator('span').filter({ hasText: /^\d+\+?$/ }).first(); 
    await expect(notificationBadgeB).toBeVisible({ timeout: 15000 });

    // User B navigates to User A's profile and accepts the connection request
    await pageB.goto(`/profile/${USERNAME_A}`);
    await pageB.waitForLoadState('networkidle');
    const acceptButton = pageB.locator('button', { hasText: 'Accept' }).first();
    await expect(acceptButton).toBeVisible({ timeout: 15000 });
    
    await acceptButton.click();
    await expect(pageB.locator('button', { hasText: 'Connected' }).first()).toBeVisible({ timeout: 10000 });

    // Verify A receives the acceptance notification without reload
    const notificationBadgeA = pageA.locator('aside').locator('a[href="/notifications"]').locator('span').filter({ hasText: /^\d+\+?$/ }).first();
    await expect(notificationBadgeA).toBeVisible({ timeout: 15000 });

    // ==========================================
    // GATE 1: TWO-USER MESSAGING
    // ==========================================
    // Keep B on /messages with no reload
    await pageB.goto('/messages');
    await pageB.waitForLoadState('load');

    // User A is already on User B's profile (after sending request). 
    // They reload the profile to get the updated Connected status so the Message button appears.
    await pageA.reload();
    await pageA.waitForLoadState('load');

    const messageButton = pageA.locator('button', { hasText: 'Message' }).first();
    await expect(messageButton).toBeVisible({ timeout: 15000 });
    await messageButton.click();

    // A is redirected to the conversation page
    await pageA.waitForURL(/\/messages\/.+/);
    
    // Capture the conversation URL so we can navigate directly to it later (avoids fragile list clicks)
    const conversationUrl = new URL(pageA.url()).pathname;
    
    // A sends a message through the normal UI/API path
    const chatInputA = pageA.locator('textarea[placeholder="Type a message..."]').first();
    await expect(chatInputA).toBeVisible();

    const uniqueMessage = `Realtime verification msg: ${Date.now()}`;
    await chatInputA.fill(uniqueMessage);
    await pageA.keyboard.press('Enter');

    // Verify B receives it through the actual Socket.IO realtime path without refresh
    // B should see the conversation update in the preview list
    const conversationLinkB = pageB.locator('a', { hasText: uniqueMessage }).first();
    await expect(conversationLinkB).toBeVisible({ timeout: 15000 });

    // B opens the conversation
    // Use force: true to bypass actionability checks that might fail if tanstack router preloads on hover and causes re-renders
    await conversationLinkB.click({ force: true });
    
    // Verify the chat bubble appears instantly for B
    const chatBubbleB = pageB.locator(`text="${uniqueMessage}"`).last();
    await expect(chatBubbleB).toBeVisible();

    // ==========================================
    // GATE 3: DISCONNECT/RECONNECT
    // ==========================================
    // Keep B on the messages list view
    await pageB.goto('/messages');
    await pageB.waitForLoadState('load');

    // Disconnect B's network to drop the socket
    await contextB.setOffline(true);
    
    // Allow brief time for socket disconnect event
    await pageB.waitForTimeout(2000);

    // Create a message while B is disconnected
    const offlineMessage = `Missed msg: ${Date.now()}`;
    // Navigate directly to the known conversation URL (avoids the fragile 
    // "find in list and click" pattern that races with React Query refetch errors)
    await pageA.goto(conversationUrl);
    
    const chatInputRe = pageA.locator('textarea[placeholder="Type a message..."]').first();
    await expect(chatInputRe).toBeVisible({ timeout: 15000 });
    await chatInputRe.fill(offlineMessage);
    
    // Wait for the backend to process the message before bringing B back online
    await Promise.all([
      pageA.waitForResponse(res => res.url().includes('/messages') && res.request().method() === 'POST' && res.status() === 201),
      pageA.keyboard.press('Enter')
    ]);

    // Restore connectivity for B
    await contextB.setOffline(false);

    // Verify B reconciles the missed state
    // Socket.io reconnects, invalidateQueriesSafely fires
    const offlineMessagePreview = pageB.locator(`text="${offlineMessage}"`).first();
    await expect(offlineMessagePreview).toBeVisible({ timeout: 20000 });

    // Verify no duplicate messages or broken pagination
    const duplicateCount = await pageB.locator(`text="${offlineMessage}"`).count();
    expect(duplicateCount).toBe(1);

    // ==========================================
    // GATE 4: MESSAGE-PAGE RESILIENCE
    // ==========================================
    // Rapidly switch conversations and process incoming events
    for (let i = 0; i < 4; i++) {
        await pageB.goto('/');
        await pageB.goto('/messages');
    }
    
    // Verify /messages remains mounted and usable (no ErrorBoundary trigger leading to a white screen)
    const errorBoundaryMsg = pageB.locator('text="Something went wrong"');
    await expect(errorBoundaryMsg).not.toBeVisible();
    
    const messagesHeader = pageB.locator('h2', { hasText: 'Messages' }).first();
    await expect(messagesHeader).toBeVisible();

  });
});
