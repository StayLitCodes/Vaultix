import { test, expect } from '@playwright/test';

test.describe('Core User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('landing page renders a top-level heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('primary escrow action is present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /create escrow/i }).first()).toBeVisible();
  });

  test('dashboard route is reachable', async ({ page }) => {
    await page.goto('/dashboard');
    const redirect = new URL(page.url());
    expect(redirect.pathname).toBe('/');
    expect(redirect.searchParams.get('returnTo')).toBe('/dashboard');
  });

  test('create-escrow page is reachable', async ({ page }) => {
    await page.goto('/escrow/create');
    const redirect = new URL(page.url());
    expect(redirect.pathname).toBe('/');
    expect(redirect.searchParams.get('returnTo')).toBe('/escrow/create');
  });

  test('transactions page is reachable', async ({ page }) => {
    await page.goto('/transactions');
    const redirect = new URL(page.url());
    expect(redirect.pathname).toBe('/');
    expect(redirect.searchParams.get('returnTo')).toBe('/transactions');
  });

  test('page title contains Vaultix', async ({ page }) => {
    await expect(page).toHaveTitle(/vaultix/i);
  });
});
