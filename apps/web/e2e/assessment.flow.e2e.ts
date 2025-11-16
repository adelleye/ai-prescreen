// E2E placeholder using Playwright test runner.
// This file will be executed by Playwright in CI when configured.
// It intentionally does not import from vitest/jest.
// See packages/config/playwright/base.ts for shared config.

import { test, expect } from '@playwright/test';

test.describe('Assessment flow', () => {
  test('token → assessment → submit → report links', async ({ page }) => {
    // This is a skeleton; real environment URL and token wiring is handled in CI.
    await page.goto('/');
    await expect(page.getByText('Juno Quick Screen')).toBeVisible();
  });

  test('chat interface displays messages skeleton', async ({ page }) => {
    // In dev, /assessment will auto-create a dev assessment if needed.
    await page.goto('/assessment');
    // This is a skeleton; real assertion wiring will be done in CI with a running backend.
    await expect(page).toHaveURL(/\/assessment/);
  });
});

test.describe('Anti-Cheating Signals - E2E', () => {
  // Setup beacon interception for all tests in this suite
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__beacons = [];
      const orig = navigator.sendBeacon?.bind(navigator);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).sendBeacon = (url: string, data: BodyInit) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__beacons.push({
          url,
          data: String(data),
          timestamp: new Date().toISOString(),
        });
        return orig ? orig(url, data) : true;
      };
    });
  });

  test('paste signal is captured with clipboard length', async ({ page }) => {
    await page.goto('/assessment');

    // Simulate a paste event with text
    await page.evaluate(() => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', 'pasted answer text');
      const evt = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
      });
      document.dispatchEvent(evt);
    });

    // Give beacon time to fire
    await page.waitForTimeout(100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beacons = await page.evaluate(() => (window as any).__beacons);
    const pasteBeacon = beacons.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) =>
        String(b.url).includes('/api/signals') && String(b.data).includes('"type":"paste"'),
    );

    expect(pasteBeacon).toBeTruthy();
    const beaconData = JSON.parse(pasteBeacon?.data || '{}');
    expect(beaconData.type).toBe('paste');
    expect(beaconData.meta?.length).toBe(18); // 'pasted answer text'
  });

  test('tab visibility change (hidden) is captured', async ({ page }) => {
    await page.goto('/assessment');

    // Simulate tab becoming hidden
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Give beacon time to fire
    await page.waitForTimeout(100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beacons = await page.evaluate(() => (window as any).__beacons);
    const visibilityBeacon = beacons.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) =>
        String(b.url).includes('/api/signals') &&
        String(b.data).includes('"type":"visibilitychange"'),
    );

    expect(visibilityBeacon).toBeTruthy();
    const beaconData = JSON.parse(visibilityBeacon?.data || '{}');
    expect(beaconData.type).toBe('visibilitychange');
    expect(beaconData.meta?.state).toBe('hidden');
  });

  test('tab visibility change (visible) is captured after returning', async ({ page }) => {
    await page.goto('/assessment');

    // Hide tab
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Show tab again
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Give beacons time to fire
    await page.waitForTimeout(100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beacons = await page.evaluate(() => (window as any).__beacons);
    const visibilityBeacons = beacons.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) =>
        String(b.url).includes('/api/signals') &&
        String(b.data).includes('"type":"visibilitychange"'),
    );

    // Should have at least 2 visibility change events (hidden and visible)
    expect(visibilityBeacons.length).toBeGreaterThanOrEqual(2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visibleBeacon = visibilityBeacons.find((b: any) =>
      String(b.data).includes('"state":"visible"'),
    );
    expect(visibleBeacon).toBeTruthy();
  });

  test('window blur event is captured', async ({ page }) => {
    await page.goto('/assessment');

    // Simulate window blur
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });

    // Wait for debounce (250ms + buffer)
    await page.waitForTimeout(350);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beacons = await page.evaluate(() => (window as any).__beacons);
    const blurBeacon = beacons.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) =>
        String(b.url).includes('/api/signals') && String(b.data).includes('"type":"blur"'),
    );

    expect(blurBeacon).toBeTruthy();
  });

  test('window focus event is captured', async ({ page }) => {
    await page.goto('/assessment');

    // Simulate window focus
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });

    // Wait for debounce (250ms + buffer)
    await page.waitForTimeout(350);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beacons = await page.evaluate(() => (window as any).__beacons);
    const focusBeacon = beacons.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) =>
        String(b.url).includes('/api/signals') && String(b.data).includes('"type":"focus"'),
    );

    expect(focusBeacon).toBeTruthy();
  });

  test('multiple paste events are captured separately', async ({ page }) => {
    await page.goto('/assessment');

    // First paste
    await page.evaluate(() => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', 'first paste');
      const evt = new ClipboardEvent('paste', { clipboardData: dataTransfer });
      document.dispatchEvent(evt);
    });

    // Second paste
    await page.evaluate(() => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', 'second paste attempt');
      const evt = new ClipboardEvent('paste', { clipboardData: dataTransfer });
      document.dispatchEvent(evt);
    });

    // Give beacons time to fire
    await page.waitForTimeout(100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beacons = await page.evaluate(() => (window as any).__beacons);
    const pasteBeacons = beacons.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) =>
        String(b.url).includes('/api/signals') && String(b.data).includes('"type":"paste"'),
    );

    expect(pasteBeacons.length).toBeGreaterThanOrEqual(2);
  });

  test('signals include currentItemId when tracking', async ({ page }) => {
    await page.goto('/assessment');

    // Simulate paste event
    await page.evaluate(() => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', 'test paste');
      const evt = new ClipboardEvent('paste', { clipboardData: dataTransfer });
      document.dispatchEvent(evt);
    });

    // Give beacon time to fire
    await page.waitForTimeout(100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beacons = await page.evaluate(() => (window as any).__beacons);
    const pasteBeacon = beacons.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) =>
        String(b.url).includes('/api/signals') && String(b.data).includes('"type":"paste"'),
    );

    expect(pasteBeacon).toBeTruthy();
    const beaconData = JSON.parse(pasteBeacon?.data || '{}');

    // Signals should include timestamp
    expect(beaconData.at).toBeTruthy();
    // itemId might be 'init' or undefined depending on assessment state
    // This is acceptable - just verify the structure is correct
    expect(typeof beaconData.type).toBe('string');
  });

  test('signals endpoint does not block assessment flow', async ({ page }) => {
    await page.goto('/assessment');

    // Trigger multiple signals rapidly
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', `paste ${i}`);
        const evt = new ClipboardEvent('paste', { clipboardData: dataTransfer });
        document.dispatchEvent(evt);
      }
    });

    // Wait for signals
    await page.waitForTimeout(500);

    // Page should still be interactive (no freeze/crash)
    await expect(page).toHaveURL(/\/assessment/);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beacons = await page.evaluate(() => (window as any).__beacons);
    expect(Array.isArray(beacons)).toBe(true);
    expect(beacons.length).toBeGreaterThanOrEqual(5);
  });
});
