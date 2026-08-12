import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1024, height: 768 } });

test('Debug Login Page', async ({ page }) => {
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(2000); // Wait for render
  await page.screenshot({ path: 'artifacts/debug-login.png', fullPage: true });
});
