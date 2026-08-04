import { test, expect } from '@playwright/test';

test.describe('Kasir Tablet Layout & Login Flow', () => {
  test.use({ viewport: { width: 1024, height: 768 } }); // Simulate Tablet landscape

  test('should login and view the history tab in tablet mode', async ({ page }) => {
    // 1. Visit the app
    await page.goto('http://localhost:4173/'); // Local preview server URL

    // 2. Select Portal Admin and login
    await page.click('button:has-text("Portal Admin")');
    await page.fill('input[placeholder="Masukkan Password Admin..."]', 'admin123');
    await page.click('button:has-text("Masuk")');

    // 3. Verify successful login (should show Header)
    await expect(page.locator('.brand-title')).toBeVisible();

    // 4. Navigate to History Tab
    await page.click('button.fnav-btn:has-text("Riwayat")');

    // 5. Verify we are in the history tab
    await expect(page.locator('#tab-riwayat')).toHaveClass(/active/);
    
    // 6. Verify the card-style GRID is actually rendered (CSS media query check)
    await expect(page.locator('#tab-riwayat .ctable tbody')).toHaveCSS('display', 'grid');

    // 7. Take a screenshot for visual verification
    await page.screenshot({ path: 'artifacts/tablet-history-layout.png', fullPage: true });
  });
});
