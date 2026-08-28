import { test, expect } from '@playwright/test'
import { loginAs } from './test-utils'

test.describe('Profile Edit', () => {
  const EMAIL = 'qa_user_a@srmist.edu.in'

  test('Edit profile display name and social links', async ({ page }) => {
    await loginAs(page, EMAIL)

    // Navigate to profile via sidebar link
    await page.click('a:has-text("Profile")')
    await page.waitForLoadState('networkidle')

    // Open edit modal
    await page.click('button:has-text("Edit Profile")')
    await expect(page.locator('#edit-profile-form')).toBeVisible()

    const newDisplay = `QA Edited ${Date.now()}`
    await page.fill('input#displayName', newDisplay)
    await page.fill('input#website', 'https://example.com')

    await page.click('button:has-text("Save Changes")')

    // Wait for the updated name to appear on the profile (modal closes optimistically)
    await expect(page.getByText(newDisplay)).toBeVisible({ timeout: 15000 })

    // Social link should be rendered (may appear in multiple places; assert first occurrence)
    await expect(page.locator('a:has-text("Website")').first()).toBeVisible()
  })
})
