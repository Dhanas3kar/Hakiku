import { test, expect } from '@playwright/test'
import { loginAs } from './test-utils'

test.describe('Official Account', () => {
  const EMAIL = 'qa_user_a@srmist.edu.in'
  const USERNAME = 'hakiku_official'
  const DISPLAY_NAME = 'HAKIKU'

  test('Follow official @hakiku_official and enforce official identity constraints', async ({
    page,
  }) => {
    await loginAs(page, EMAIL)

    // Register listener before navigation so the profile request cannot be missed.
    const profileResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/profile/username/${USERNAME}`) &&
        response.request().method() === 'GET',
      { timeout: 10_000 },
    )

    await page.goto(`/profile/${USERNAME}`)

    // The canonical official profile must exist.
    const profileResponseResult = await profileResponse
    expect(profileResponseResult.status()).toBe(200)

    // Canonical identity.
    await expect(
      page.getByText(DISPLAY_NAME, { exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 })

    await expect(
      page.getByText(`@${USERNAME}`, { exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 })

    // Official verification badge.
    await expect(
      page.getByLabel('Verified Official Account').first(),
    ).toBeVisible({ timeout: 5_000 })

    // ------------------------------------------------------------
    // OFFICIAL ACCOUNT CONSTRAINT
    // ------------------------------------------------------------
    // Normal users can FOLLOW the official account,
    // but must NOT be able to CONNECT to it.

    await expect(
      page.getByRole('button', { name: /^Connect$/i }),
    ).toHaveCount(0)

    // ------------------------------------------------------------
    // FOLLOW
    // ------------------------------------------------------------

    const followButton = page.getByRole('button', {
      name: /^Follow$/i,
    })

    const followingButton = page.getByRole('button', {
      name: /^Following$/i,
    })

    // Fresh state: follow the official account.
    if (await followButton.count() > 0) {
      await expect(followButton.first()).toBeVisible({
        timeout: 5_000,
      })

      await followButton.first().scrollIntoViewIfNeeded()

      const followResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/networking/follow/') &&
          response.request().method() === 'POST',
        { timeout: 5_000 },
      )

      await followButton.first().click()

      const response = await followResponse
      expect([200, 201]).toContain(response.status())

      // Allow React Query / UI state to update naturally.
      await expect(followingButton.first()).toBeVisible({
        timeout: 10_000,
      })
    } else {
      // Existing state: test account is already following HAKIKU.
      await expect(followingButton.first()).toBeVisible({
        timeout: 5_000,
      })
    }
  })
})