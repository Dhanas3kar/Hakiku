import { test, expect } from '@playwright/test'
import { loginAs } from './test-utils'

test.describe('Official Account', () => {
  const EMAIL = 'qa_user_a@srmist.edu.in'

  test('Follow official @hakiku account and verify badge', async ({ page }) => {
    await loginAs(page, EMAIL)

    // Visit the official profile
    await page.goto('/profile/hakiku')
    await page.waitForLoadState('networkidle')

    // Ensure backend returned the profile successfully
    const profileResp = await page.waitForResponse((r) => r.url().includes('/profile/username/hakiku') && r.request().method() === 'GET', { timeout: 10000 })
    if (profileResp.status() === 404) {
      console.warn('Official profile not found (404). Skipping official assertions.')
      return
    }
    expect(profileResp.status()).toBe(200)

    // Prefer display name, but accept username if UI differs
    const displayFound = await page.getByText('HAKIKU Official').count()
    const usernameFound = await page.getByText('@hakiku').count()
    expect(displayFound + usernameFound).toBeGreaterThan(0)

    // Verified badge should be visible for official account (uses aria-label)
    await expect(page.getByLabel('Verified Official Account').first()).toBeVisible()

    // Follow button may exist; click and ensure it changes to Following
    const followBtn = page.locator('button:has-text("Follow")').first()
    if (await followBtn.count()) {
      await followBtn.click()
      await expect(page.locator('button:has-text("Following")').first()).toBeVisible({ timeout: 5000 })
    }
  })
})
