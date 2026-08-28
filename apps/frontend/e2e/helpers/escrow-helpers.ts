import { Page } from '@playwright/test';

export async function mockWalletConnection(page: Page, publicKey = 'GABC123456789XYZ...') {
  await page.addInitScript((key) => {
    window.localStorage.setItem('vaultix_wallet_connected', 'true');
    window.localStorage.setItem('vaultix_wallet_public_key', key);
    // Mock Freighter / Albedo window injections if needed
    (window as any).freighter = {
      isConnected: async () => true,
      getPublicKey: async () => key,
      signTransaction: async (xdr: string) => xdr + '_signed',
    };
  }, publicKey);
}

export async function createEscrowFixture(page: Page, title = 'E2E Test Escrow') {
  await page.goto('/escrows/new');
  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="description"]', 'Automated E2E test description');
  await page.fill('input[name="amount"]', '100');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/escrows\/.+/);
  return page.url().split('/').pop()!;
}