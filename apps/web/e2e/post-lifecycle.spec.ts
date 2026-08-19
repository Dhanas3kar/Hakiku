import { test, expect } from '@playwright/test';
import { loginAs } from './test-utils';

test.describe('2. POST LIFECYCLE', () => {
  const EMAIL_A = 'qa_user_a@srmist.edu.in';
  const UNIQUE_TEXT = `QA Test Post ${Date.now()}`;
  const UPDATED_TEXT = `${UNIQUE_TEXT} - Edited`;

  test('Create, edit, and delete a post', async ({ page }) => {
    // 1. Login
    await loginAs(page, EMAIL_A);

    // 2. Create Post
    // Wait for the create post input and fill it
    const textarea = page.locator('textarea[placeholder="What\'s happening on campus?"]').first();
    await textarea.fill(UNIQUE_TEXT);
    
    // Click Post
    await page.click('button:has-text("Post")');

    // 3. Verify it appears on the feed
    // Wait for the new post text to be visible on the page
    const postLocator = page.locator(`text="${UNIQUE_TEXT}"`);
    await expect(postLocator).toBeVisible({ timeout: 10000 });

    // 4. Edit Post
    // Find the options menu for the specific post
    // We can find the closest article or post container and find the dropdown trigger inside it
    const postContainer = page.locator('article').filter({ hasText: UNIQUE_TEXT }).first();
    
    // Click the dropdown menu trigger (usually an icon button in the header of the post)
    await postContainer.locator('button[aria-label="More options"]').first().click();
    
    // Click Edit
    await page.click('button:has-text("Edit Post")');
    
    // Wait for edit dialog
    const editArea = page.locator('textarea[placeholder="What do you want to talk about?"]').first();
    await editArea.fill(UPDATED_TEXT);
    
    // Log any responses to PATCH /posts/*
    page.on('response', response => {
        if (response.request().method() === 'PATCH' && response.url().includes('/posts/')) {
            console.log(`PATCH ${response.url()} - Status: ${response.status()}`);
            response.text().then(text => console.log('Response body:', text)).catch(() => {});
        }
    });

    await page.click('button:has-text("Save")');

    // Wait for the PATCH request to complete
    await page.waitForResponse(response =>
      response.url().includes('/posts/') && response.request().method() === 'PATCH', { timeout: 20000 }
    );

    // Wait for the edit modal to be hidden
    await page.waitForSelector('text="Edit Post"', { state: 'hidden', timeout: 15000 });

    // Verify it was updated
    await expect(page.locator(`text="${UPDATED_TEXT}"`)).toBeVisible({ timeout: 10000 });
    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text="${UPDATED_TEXT}"`)).toBeVisible({ timeout: 10000 });

    // 5. Delete Post
    // Find the options menu again
    const updatedPostContainer = page.locator('article').filter({ hasText: UPDATED_TEXT }).first();
    await updatedPostContainer.locator('button[aria-label="More options"]').first().click();
    
    // Handle the window.confirm dialog for deletion
    page.once('dialog', dialog => dialog.accept());
    
    // Click Delete
    await page.click('button:has-text("Delete")');

    // Verify it's gone
    await expect(page.locator(`text="${UPDATED_TEXT}"`)).not.toBeVisible({ timeout: 10000 });
    // Reload to ensure deletion persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text="${UPDATED_TEXT}"`)).not.toBeVisible({ timeout: 10000 });
  });
});
