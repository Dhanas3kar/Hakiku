import * as fs from 'fs';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import Redis from 'ioredis';

const BASE_URL = 'http://localhost:3000';

const LOGIN_URL = `${BASE_URL}/login`;
const VERIFY_OTP_URL = `${BASE_URL}/verify-otp`;

const redis = new Redis('redis://127.0.0.1:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

const OTP_LOG_PATH =
  'C:\\Users\\Dhanasekar Murugesan\\.gemini\\antigravity-ide\\brain\\0c4b6639-9972-42b3-bddd-a4f4d99fecdd\\.system_generated\\tasks\\task-6631.log';

/**
 * Small utility used instead of relying on arbitrary fixed sleeps.
 */
async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clears Redis state used by the application's authentication/rate-limit
 * mechanisms.
 *
 * This is intentionally best-effort. Redis being unavailable should produce
 * a useful warning, but should not obscure the actual browser failure.
 */
async function clearRedisState(): Promise<void> {
  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }

    await redis.flushall();

    console.log('[E2E] Redis state cleared');
  } catch (error) {
    console.warn(
      '[E2E] Failed to clear Redis state:',
      error instanceof Error ? error.message : error,
    );
  }
}

import { createHmac } from 'crypto';

/**
 * Overrides the OTP in Redis with a known value for E2E testing.
 *
 * Instead of trying to parse stdout logs (which fails depending on how the backend is run),
 * this forces a known OTP ('123456') into Redis using the same hashing algorithm as the backend.
 */
export async function getLatestOtp(email: string): Promise<string> {
  // Give the backend a moment to finish writing its own OTP first
  await sleep(1000);

  const otp = '123456';
  const secret = process.env.OTP_SECRET || 'dev-secret';
  const hashedOtp = createHmac('sha256', secret).update(otp).digest('hex');
  
  const otpKey = `auth:otp:${email}`;
  
  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }
    
    await redis.set(otpKey, hashedOtp, 'EX', 300);
    console.log(`[E2E] OTP overridden in Redis for ${email}`);
    
    return otp;
  } catch (error) {
    throw new Error(
      `[E2E] Failed to override OTP in Redis: ${error instanceof Error ? error.message : String(error)}`
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

  await clearRedisState();

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

  await verifyButton.click();

  /*
   * STEP 9
   * Authentication MUST redirect to home.
   *
   * This is the critical part that the previous implementation
   * was incorrectly swallowing.
   */
  try {
    await page.waitForURL(
      (url) => {
        return (
          url.origin === BASE_URL &&
          url.pathname === '/'
        );
      },
      {
        timeout: 15000,
      },
    );
  } catch (error) {
    const diagnostics = await collectLoginDiagnostics(page);

    throw new Error(
      `[E2E] OTP verification did not complete for ${email}.\n` +
      `${diagnostics}\n` +
      `Original error: ${error instanceof Error ? error.message : error
      }`,
    );
  }

  /*
   * STEP 10
   * URL alone is not enough.
   *
   * Confirm that authenticated UI actually rendered.
   */
  console.log('[E2E] Authentication redirect successful');

  await expect(
    page.getByText('Home', { exact: true }).first(),
  ).toBeVisible({
    timeout: 10000,
  });

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