import { test, expect } from '@playwright/test';
import { mockWalletConnection, createEscrowFixture } from './helpers/escrow-helpers';

test.describe('Escrow Lifecycle & Advanced Flows (#527)', () => {
  
  test.beforeEach(async ({ page }) => {
    await mockWalletConnection(page);
  });

  test('Full lifecycle: create → fund → release → completed', async ({ page }) => {
    // 1. Create
    const escrowId = await createEscrowFixture(page, 'Lifecycle Test Escrow');
    expect(escrowId).toBeTruthy();

    // 2. Fund
    await page.click('button:has-text("Fund Escrow")');
    await expect(page.locator('text=funded')).toBeVisible({ timeout: 10000 });

    // 3. Release Funds
    await page.click('button:has-text("Release Funds")');
    await expect(page.locator('text=completed')).toBeVisible({ timeout: 10000 });
  });

  test('Cancellation flow: create → cancel before funding', async ({ page }) => {
    const escrowId = await createEscrowFixture(page, 'Cancellable Escrow');
    
    // Cancel before funding
    await page.click('button:has-text("Cancel Escrow")');
    await page.click('button:has-text("Confirm Cancellation")');
    
    await expect(page.locator('text=cancelled')).toBeVisible({ timeout: 10000 });
  });

  test('Mobile viewport verification (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/escrows');
    
    // Ensure mobile navigation or responsive table is functional
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Escrows');
  });
});