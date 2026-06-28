import { test, expect } from '@playwright/test';

test.describe('Core User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('landing page renders a top-level heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('connect wallet call-to-action is present', async ({ page }) => {
    const connectBtn = page.getByRole('button', { name: /connect wallet/i });
    const getStarted = page.getByRole('link', { name: /get started/i });
    await expect(connectBtn.or(getStarted)).toBeVisible();
  });

  test('dashboard route is reachable', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/(dashboard|login|\?)/);
  });

  test('create-escrow page is reachable', async ({ page }) => {
    await page.goto('/escrow/create');
    await expect(page).toHaveURL(/\/escrow\/create/);
  });

  test('transactions page is reachable', async ({ page }) => {
    await page.goto('/transactions');
    await expect(page).toHaveURL(/\/transactions/);
  });

  test('page title contains Vaultix', async ({ page }) => {
    await expect(page).toHaveTitle(/vaultix/i);
  });
});
