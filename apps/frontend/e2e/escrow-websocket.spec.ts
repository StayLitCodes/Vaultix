import { test, expect } from '@playwright/test';

test.describe('WebSocket Real-time Updates & Recovery', () => {
  test('Dashboard displays live connection recovery banner upon network loss', async ({ page }) => {
    let simulateOffline = false;
    let activeWebSocket: any = null;

    await page.routeWebSocket('**/socket.io/?*', ws => {
      if (simulateOffline) {
        ws.close();
        return;
      }

      activeWebSocket = ws;
      
      ws.send('0' + JSON.stringify({
        sid: "mock-test-session",
        upgrades: [],
        pingInterval: 25000,
        pingTimeout: 20000
      }));

      ws.onMessage(message => {
        const msg = typeof message === 'string' ? message : message.toString();
        
        if (msg.startsWith('40')) {
          ws.send('40{"sid":"mock-test-session"}');
        }
        
        if (msg === '2') {
          ws.send('3');
        }
      });
    });

    await page.goto('/dashboard');

    const connectionBanner = page.getByText(/Reconnecting to live updates/i);
    
    await expect(connectionBanner).toBeHidden({ timeout: 10000 });

    simulateOffline = true;
    if (activeWebSocket) {
      activeWebSocket.close();
    }
    
    await expect(connectionBanner).toBeVisible({ timeout: 10000 });
    
    simulateOffline = false;
    
    await expect(connectionBanner).toBeHidden({ timeout: 15000 });
  });
});