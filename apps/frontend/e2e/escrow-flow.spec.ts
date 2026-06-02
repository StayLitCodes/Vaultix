import { test, expect } from '@playwright/test';

test.describe('Vaultix Escrow Flows', () => {
  test.beforeEach(async ({ page }) => {
    // In real E2E, we might mock Freighter using a helper or just test the UI
    await page.goto('/');
  });

  test('Wallet connection flow', async ({ page }) => {
    // Click connect button
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i });
    if (await connectButton.isVisible()) {
      await connectButton.click();
    } else {
      await page.click('header button:has-text("Connect")');
    }

    // Modal should show up
    await expect(page.getByText('Connect Wallet')).toBeVisible();
    
    // Check for Freighter
    const freighterButton = page.getByRole('button', { name: /Freighter/i });
    await expect(freighterButton).toBeVisible();
    
    // Simulating connection (This might be hard without real extension)
    // In real E2E with Playwright, you often mock the window.starknet or window.stellar
  });

  test('Navigate to Create Escrow from landing', async ({ page }) => {
    // If there is a "Create Escrow" or "Get Started" button
    const getStarted = page.getByRole('link', { name: /Get Started/i });
    if (await getStarted.isVisible()) {
      await getStarted.click();
    } else {
      await page.goto('/escrow/create');
    }
    
    await expect(page).toHaveURL(/.*escrow\/create/);
    await expect(page.getByText('Basic Information')).toBeVisible();
  });

  test('View Escrow Dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Check if some escrow cards are rendered
    await expect(page.getByText(/Escrows/i)).toBeVisible();
    // Assuming there is at least one escrow from mock data
    const cards = page.locator('div:has-text("Website Development")');
    // We expect some content to be present eventually
    await expect(page.getByText(/Created|Funded|Completed/i).first()).toBeVisible();
  });
});
