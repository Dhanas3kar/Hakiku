import { test, expect } from '@playwright/test';
import { loginAs } from './test-utils';

test.describe('1. AUTH', () => {
  const EMAIL = 'qa_user_a@srmist.edu.in';

  test('Login as QA_USER_A, check session persistence, and logout', async ({ page }) => {
    // Perform login
    await loginAs(page, EMAIL);

    // Verify session persistence by reloading
    await page.reload();
    await expect(page).toHaveURL(/.*(?:localhost:3000|\/)$/);
    await expect(page.locator('text=Home').first()).toBeVisible();

    // Logout
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await page.locator('button:has-text("Logout")').first().click();
    
    // Should be redirected to login
    await expect(page).toHaveURL(/.*\/login.*/);
  });
});
