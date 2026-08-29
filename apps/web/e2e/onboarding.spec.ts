import { test, expect } from '@playwright/test'
import { loginAs } from './test-utils'

test.describe('Onboarding', () => {
  test('Completes onboarding for a new user', async ({ page }) => {
    const runId = Math.random().toString(36).substring(2, 8)
    const email = `qa_onb_${runId}@srmist.edu.in`

    await loginAs(page, email)

    // After onboarding, the home UI should render and display 'Home' (link or mobile button)
    const homeLink = page.getByRole('link', { name: 'Home' }).first()
    if (await homeLink.count()) {
      if (await homeLink.isVisible()) {
        await expect(homeLink).toBeVisible({ timeout: 10000 })
      } else {
        const homeButton = page.getByRole('button', { name: 'Home' }).first()
        await expect(homeButton).toBeVisible({ timeout: 10000 })
      }
    } else {
      const homeButton = page.getByRole('button', { name: 'Home' }).first()
      await expect(homeButton).toBeVisible({ timeout: 10000 })
    }

    // Sidebar/profile link should include /profile/
    const profileLink = await page.locator('a').filter({ hasText: 'Profile' }).first().getAttribute('href')
    expect(profileLink).toContain('/profile/')
  })
})
