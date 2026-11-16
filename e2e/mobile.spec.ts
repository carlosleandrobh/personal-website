import { devices, expect, test } from '@playwright/test';
import { cutOffAtTheRight, smallTargets } from './helpers';

// Phone emulation: a phone-sized screen, touch, a mobile user agent and the device's pixel ratio. Chromium emulates
// both profiles (the iPhone profile normally asks for WebKit, so that choice is dropped and the project's Chromium,
// the only browser CI installs, is used). The rest of the suite resizes a desktop window; these checks cover what only a phone does.
const PHONES = [
  ['iPhone SE', devices['iPhone SE']],
  ['Pixel 7', devices['Pixel 7']],
] as const;

const SIZES = [
  { name: 'normal text', prefs: undefined },
  { name: '200% text', prefs: { text: '200' } },
] as const;

const KEY_PAGES = ['/', '/labs/', '/contact/'];

for (const [phone, device] of PHONES) {
  for (const size of SIZES) {
    test.describe(`${phone}, ${size.name}`, () => {
      const { defaultBrowserType: _browser, ...profile } = device;
      test.use(profile);

      // Same start as e2e/a11y.spec.ts: the welcome window is answered, and nothing loads from another origin.
      test.beforeEach(async ({ page, baseURL }) => {
        await page.addInitScript(() => localStorage.setItem('a11y-welcomed', '1'));
        if (size.prefs) await page.addInitScript((value) => localStorage.setItem('a11y-prefs', value), JSON.stringify(size.prefs));
        await page.route('**/*', (route) => {
          const origin = new URL(route.request().url()).origin;
          return origin === baseURL ? route.continue() : route.abort();
        });
      });

      test('the menu button says whether the menu is open when tapped', async ({ page }) => {
        await page.goto('/');
        const toggle = page.locator('[data-menu-toggle]');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle).toHaveAttribute('aria-label', 'Open menu');
        await toggle.tap();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(toggle).toHaveAttribute('aria-label', 'Close menu');
        await expect(page.locator('#mobile-menu')).toBeVisible();
        await toggle.tap();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle).toHaveAttribute('aria-label', 'Open menu');
        await expect(page.locator('#mobile-menu')).toBeHidden();
      });

      test('every link in the open menu can be scrolled into view and tapped', async ({ page }) => {
        await page.goto('/');
        await page.locator('[data-menu-toggle]').tap();
        const viewport = page.viewportSize()!;
        const links = page.locator('#mobile-menu a');
        const count = await links.count();
        expect(count).toBeGreaterThan(1);
        for (let i = 0; i < count; i++) {
          const link = links.nth(i);
          await link.scrollIntoViewIfNeeded();
          const box = (await link.boundingBox())!;
          const name = (await link.textContent())?.trim();
          expect(box.y, `"${name}" starts on screen`).toBeGreaterThanOrEqual(0);
          expect(box.y + box.height, `"${name}" ends on screen`).toBeLessThanOrEqual(viewport.height);
          expect(box.x + box.width, `"${name}" fits across the screen`).toBeLessThanOrEqual(viewport.width);
        }
        const last = links.last();
        const href = await last.getAttribute('href');
        await last.tap();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
      });

      test('keyboard focus in the open menu brings each link into view', async ({ page }) => {
        await page.goto('/');
        const toggle = page.locator('[data-menu-toggle]');
        await toggle.focus();
        await page.keyboard.press('Enter');
        const viewport = page.viewportSize()!;
        const links = page.locator('#mobile-menu a');
        const count = await links.count();
        for (let i = 0; i < count; i++) {
          await page.keyboard.press('Tab');
          await expect(links.nth(i)).toBeFocused();
          const box = (await links.nth(i).boundingBox())!;
          expect(box.y + box.height, `"${(await links.nth(i).textContent())?.trim()}" ends on screen`).toBeLessThanOrEqual(viewport.height);
        }
      });

      for (const path of KEY_PAGES) {
        test(`${path} has no sideways scrolling and nothing cut off at the right`, async ({ page }) => {
          await page.goto(path);
          const width = await page.evaluate(() => document.documentElement.scrollWidth);
          expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
          expect(await cutOffAtTheRight(page), 'nothing may be cut off at the right edge').toEqual([]);
        });

        test(`${path}: every control that stands on its own is at least 44 px tall and wide`, async ({ page }) => {
          await page.goto(path);
          expect(await smallTargets(page)).toEqual([]);
        });
      }
    });
  }
}
