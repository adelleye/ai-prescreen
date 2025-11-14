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

  test('integrity beacons capture paste', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__beacons = [];
      const orig = navigator.sendBeacon?.bind(navigator);
      (navigator as any).sendBeacon = (url: string, data: BodyInit) => {
        (window as any).__beacons.push({ url, data: String(data) });
        return orig ? orig(url, data) : true;
      };
    });
    await page.goto('/assessment');
    // Simulate a paste event
    await page.evaluate(() => {
      const evt = new ClipboardEvent('paste');
      document.dispatchEvent(evt);
    });
    const beacons = await page.evaluate(() => (window as any).__beacons);
    expect(Array.isArray(beacons)).toBe(true);
    const found = beacons.find((b: any) => String(b.url).includes('/api/signals') && String(b.data).includes('"type":"paste"'));
    expect(found).toBeTruthy();
  });

  test('chat interface displays messages skeleton', async ({ page }) => {
    // In dev, /assessment will auto-create a dev assessment if needed.
    await page.goto('/assessment');
    // This is a skeleton; real assertion wiring will be done in CI with a running backend.
    await expect(page).toHaveURL(/\/assessment/);
  });
});


