import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import Redis from 'ioredis';
import { createHmac } from 'crypto';

const BASE_URL = 'http://localhost:3000';

const redis = new Redis('redis://127.0.0.1:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

/**
 * Clears ONLY the auth-related Redis keys for the given test user.
 *
 * We intentionally do NOT use flushall() here because it disrupts the
 * NestJS ThrottlerStorageRedisService (and other infrastructure) that
 * maintains its own Redis-backed counters. Flushing all keys on the first
 * test causes the throttler to encounter missing keys mid-request, which
 * can produce unhandled errors that drop the Fastify connection and appear
 * as a network-level failure in the browser ("Unable to connect to server").
 *
 * Targeted deletion of the four auth key patterns is sufficient to reset
 * the OTP state without disturbing any other infrastructure.
 */
async function clearRedisState(email: string): Promise<void> {
  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }

    const keysToDelete = [
      `auth:otp:${email}`,
      `auth:otp_attempts:${email}`,
      `auth:cooldown:${email}`,
      `auth:rate_limit:otp_requests:${email}`,
    ];

    // del accepts multiple keys; filter to only those that exist to avoid
    // unnecessary RESP round-trips, then delete in a single command.
    await redis.del(...keysToDelete);

    console.log('[E2E] Redis auth state cleared for test user');
  } catch (error) {
    console.warn(
      '[E2E] Failed to clear Redis state:',
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Overrides the OTP in Redis with a known value for E2E testing.
 *
 * Instead of trying to parse stdout logs (which fails depending on how the backend is run),
 * this forces a known OTP ('123456') into Redis using the same hashing algorithm as the backend.
 *
 * We poll for the key to appear (written by the backend's generateOtp) before
 * overriding it. This avoids an arbitrary sleep() while still giving the
 * backend time to complete the write after the send-otp API call returns.
 */
export async function getLatestOtp(email: string): Promise<string> {
  const otp = '123456';
  const secret = process.env.OTP_SECRET || 'dev-secret';
  const hashedOtp = createHmac('sha256', secret).update(otp).digest('hex');

  const otpKey = `auth:otp:${email}`;

  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }

    // Poll until the backend has written its own OTP key (max 5s, check every 100ms).
    // The key is written synchronously inside generateOtp before the API responds,
    // so it will exist by the time waitForURL('/verify-otp') resolves. We poll
    // just in case there is a Redis propagation delay on slower machines.
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const existing = await redis.exists(otpKey);
      if (existing) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    // Override with the known OTP so the test can submit a predictable value.
    await redis.set(otpKey, hashedOtp, 'EX', 300);
    console.log('[E2E] OTP overridden in Redis');

    return otp;
  } catch (error) {
    throw new Error(
      `[E2E] Failed to override OTP in Redis: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Returns a useful authentication error from the current page.
 */
async function getAuthenticationError(page: Page): Promise<string | null> {
  const candidates = [
    '[role="alert"]',
    '.text-danger',
    '[data-testid="error"]',
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).first();

    if (await locator.count()) {
      const text = await locator.textContent().catch(() => null);

      if (text?.trim()) {
        return text.trim();
      }
    }
  }

  return null;
}

/**
 * Dumps useful browser state when authentication fails.
 */
async function collectLoginDiagnostics(page: Page): Promise<string> {
  const url = page.url();

  let title = 'unknown';

  try {
    title = await page.title();
  } catch {
    // Page may already be closing.
  }

  const error = await getAuthenticationError(page);

  return [
    `URL: ${url}`,
    `Title: ${title}`,
    error ? `Authentication error: ${error}` : 'Authentication error: none',
  ].join('\n');
}

/**
 * Logs in a QA user through the real UI authentication flow.
 *
 * Expected flow:
 *
 *   /
 *    ↓
 *   /login
 *    ↓
 *   submit email
 *    ↓
 *   /verify-otp
 *    ↓
 *   enter OTP
 *    ↓
 *   Verify & Continue
 *    ↓
 *   /
 *
 * Any unexpected state is treated as a real test failure.
 */
export async function loginAs(
  page: Page,
  email: string,
): Promise<void> {
  console.log(`\n[E2E] Starting login for ${email}`);

  await clearRedisState(email);

  /*
   * STEP 1
   * Open application.
   */
  console.log('[E2E] Opening application');

  await page.goto('/', {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  /*
   * STEP 2
   * The unauthenticated user should be redirected to /login.
   */
  console.log('[E2E] Waiting for login page');

  await page.waitForURL(/\/login(?:\?.*)?$/, {
    timeout: 10000,
  });

  await expect(
    page.locator('input[type="email"]'),
  ).toBeVisible({
    timeout: 5000,
  });

  /*
   * STEP 3
   * Submit email.
   */
  console.log(`[E2E] Submitting email: ${email}`);

  const emailInput = page.locator('input[type="email"]').first();

  await emailInput.fill(email);

  const submitButton = page
    .locator('button[type="submit"]')
    .first();

  await expect(submitButton).toBeEnabled({
    timeout: 5000,
  });

  await submitButton.click();

  /*
   * STEP 4
   * OTP page MUST appear.
   *
   * There is intentionally no fallback here.
   *
   * If OTP authentication is enabled and this doesn't happen,
   * the test must fail.
   */
  console.log('[E2E] Waiting for OTP page');

  try {
    await page.waitForURL(/\/verify-otp(?:\?.*)?$/, {
      timeout: 10000,
    });
  } catch (error) {
    const diagnostics = await collectLoginDiagnostics(page);

    throw new Error(
      `[E2E] OTP page was not reached for ${email}.\n` +
      `${diagnostics}\n` +
      `Original error: ${error instanceof Error ? error.message : error
      }`,
    );
  }

  /*
   * STEP 5
   * Verify OTP UI actually rendered.
   */
  console.log('[E2E] OTP page reached');

  const otpInputs = page.locator(
    'input[type="text"][inputmode="numeric"]',
  );

  await expect(otpInputs).toHaveCount(6, {
    timeout: 5000,
  });

  /*
   * STEP 6
   * Retrieve OTP.
   */
  console.log('[E2E] Waiting for OTP');

  const otp = await getLatestOtp(email);

  if (!/^\d{6}$/.test(otp)) {
    throw new Error(
      `[E2E] Invalid OTP returned for ${email}: "${otp}"`,
    );
  }

  console.log('[E2E] Filling OTP');

  /*
   * STEP 7
   * Fill each OTP digit.
   */
  for (let i = 0; i < 6; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  /*
   * Confirm all six values were actually entered.
   */
  for (let i = 0; i < 6; i++) {
    await expect(otpInputs.nth(i)).toHaveValue(otp[i]);
  }

  /*
   * STEP 8
   * Submit OTP.
   *
   * Prefer the semantic button name used by your actual UI.
   */
  const verifyButton = page.getByRole('button', {
    name: 'Verify & Continue',
    exact: true,
  });

  await expect(verifyButton).toBeVisible({
    timeout: 5000,
  });

  await expect(verifyButton).toBeEnabled({
    timeout: 5000,
  });

  console.log('[E2E] Submitting OTP');

  // Capture the verify-otp API response to help diagnose failures without
  // relying on the generic "Unable to connect" frontend message.
  const otpResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/auth/verify-otp'),
    { timeout: 10000 },
  ).then((response) => {
    console.log(`[E2E] /auth/verify-otp → HTTP ${response.status()}`);
    return response;
  }).catch((err) => {
    // If no response is received at all, the fetch itself failed at network level.
    console.warn(`[E2E] /auth/verify-otp received no response: ${err instanceof Error ? err.message : err}`);
    return null;
  });

  await verifyButton.click();

  // Await the captured response before checking the URL, so the status
  // is logged regardless of whether OTP verification succeeds.
  await otpResponsePromise;

  /*
   * STEP 9
   * Authentication MUST redirect to home.
   *
   * This is the critical part that the previous implementation
   * was incorrectly swallowing.
   */
  let isOnboarding = false;
  try {
    await page.waitForURL(
      (url) => {
        return (
          url.origin === BASE_URL &&
          (url.pathname === '/' || url.pathname.startsWith('/onboarding'))
        );
      },
      {
        timeout: 15000,
      },
    );
    isOnboarding = page.url().includes('/onboarding');
  } catch (error) {
    const diagnostics = await collectLoginDiagnostics(page);

    throw new Error(
      `[E2E] OTP verification did not complete for ${email}.\n` +
      `${diagnostics}\n` +
      `Original error: ${error instanceof Error ? error.message : error
      }`,
    );
  }

  if (isOnboarding) {
    console.log('[E2E] Filling out onboarding form');
    const uniqueId = Math.floor(Math.random() * 1000000);
    await page.locator('input[name="username"]').fill(`qa_user_${uniqueId}`);
    await page.locator('input[name="displayName"]').fill('QA User');
    await page.locator('input[name="degreeProgram"]').fill('B.Tech');
    await page.locator('input[name="department"]').fill('Software Engineering');
    await page.locator('input[name="batchYear"]').fill('2023');
    // graduationYear is optional and sometimes not present in the form; only fill if it exists
    const gradExists = await page.locator('input[name="graduationYear"]').count();
    if (gradExists) {
      await page.locator('input[name="graduationYear"]').fill('2027');
    }

    // Step through onboarding steps: Continue -> Upload avatar -> Continue -> Complete Setup
    const continueBtn = page.getByRole('button', { name: 'Continue' }).first();
    await expect(continueBtn).toBeEnabled({ timeout: 5000 });
    await continueBtn.click();

    // Step 2 requires an avatar; provide a tiny in-memory PNG to satisfy the form
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
    await page.setInputFiles('input[type="file"]', [{ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(pngBase64, 'base64') }]);

    const continueBtn2 = page.getByRole('button', { name: 'Continue' }).first();
    await expect(continueBtn2).toBeEnabled({ timeout: 5000 });
    await continueBtn2.click();

    const completeButton = page.getByRole('button', { name: 'Complete Setup' });
    await expect(completeButton).toBeEnabled({ timeout: 5000 });
    await completeButton.click();

    await page.waitForURL(
      (url) => url.origin === BASE_URL && url.pathname === '/',
      { timeout: 20000 }
    );
  }

  /*
   * STEP 10
   * URL alone is not enough.
   *
   * Confirm that authenticated UI actually rendered.
   */
  console.log('[E2E] Authentication redirect successful');

  // Home may render as a sidebar link or a mobile button; accept either when visible
  const homeLink = page.getByRole('link', { name: 'Home' }).first();
  if (await homeLink.count()) {
    if (await homeLink.isVisible()) {
      await expect(homeLink).toBeVisible({ timeout: 10000 });
    } else {
      const homeButton = page.getByRole('button', { name: 'Home' }).first();
      await expect(homeButton).toBeVisible({ timeout: 10000 });
    }
  } else {
    const homeButton = page.getByRole('button', { name: 'Home' }).first();
    await expect(homeButton).toBeVisible({ timeout: 10000 });
  }

  console.log(`[E2E] Login successful for ${email}\n`);
}

/**
 * Optional cleanup helper for tests.
 */
export async function closeTestRedis(): Promise<void> {
  try {
    if (redis.status !== 'end') {
      await redis.quit();
    }
  } catch {
    redis.disconnect();
  }
}