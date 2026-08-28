import { test, expect } from '@playwright/test'
import { loginAs } from './test-utils'

const viewports = [
  { w: 320, h: 568 },
  { w: 360, h: 640 },
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 412, h: 915 },
  { w: 430, h: 932 },
]

test.describe('Responsive & UI basics', () => {
  for (const vp of viewports) {
    test(`Layout at ${vp.w}x${vp.h}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h })
      const email = `qa_resp_${vp.w}_${Date.now()}@srmist.edu.in`
      await loginAs(page, email)

      // Splash should be gone after load; ensure main UI present (Home may be a link or mobile button)
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

      // Open settings and toggle theme to ensure theme switching works on mobile
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible()
      await page.click('button:has-text("Dark")')
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      expect(isDark).toBeTruthy()
    })
  }
})
