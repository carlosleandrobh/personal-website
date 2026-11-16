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

// Barriers found by a phone-only review (16 Nov 2026). Each test names what it guards against.
test.describe('phone-only barriers', () => {
  const { defaultBrowserType: _browser, ...iphone } = devices['iPhone SE'];
  test.use(iphone);

  const start = (prefs?: Record<string, string>) => async ({ page, baseURL }: { page: import('@playwright/test').Page; baseURL: string | undefined }) => {
    await page.addInitScript(() => localStorage.setItem('a11y-welcomed', '1'));
    if (prefs) await page.addInitScript((value) => localStorage.setItem('a11y-prefs', value), JSON.stringify(prefs));
    await page.route('**/*', (route) => (new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort()));
  };

  for (const prefs of [{ aloud: 'on' }, { aloud: 'on', text: '200' }]) {
    test(`the read-aloud player never covers the focused element (${prefs.text ? '200% text' : 'normal text'})`, async ({ page, baseURL }) => {
      // WCAG 2.4.11: the player is fixed at the bottom, and the browser scrolled focus to just above the screen's edge,
      // under the player. The page now keeps room for it when scrolling to the focused element.
      await start(prefs)({ page, baseURL });
      const covered: string[] = [];
      for (const path of ['/', '/contact/']) {
        await page.goto(path);
        await expect(page.locator('[data-listen-player]')).toBeVisible();
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press('Tab');
          const hit = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            const player = document.querySelector('[data-listen-player]')!;
            if (!el || el === document.body || player.contains(el) || el.closest('[data-site-header]') || el.classList.contains('sr-only')) return null; // body: Tab went past the last stop
            const a = el.getBoundingClientRect();
            const b = player.getBoundingClientRect();
            const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            return overlap > 0 && across > 0 ? `${(el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)} (${Math.round(overlap)} px)` : null;
          });
          if (hit) covered.push(`${path}: ${hit}`);
        }
      }
      expect(covered).toEqual([]);
    });
  }

  test('in landscape the read-aloud player scrolls with the page, like the header', async ({ page, baseURL }) => {
    // Rule 17: on a short screen nothing fixed may take real height. The player covered 63% of a 375 px tall screen.
    await start({ aloud: 'on', text: '200' })({ page, baseURL });
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/');
    const player = page.locator('[data-listen-player]');
    await expect(player).toBeVisible();
    expect(await player.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');
  });

  test('choosing 200% text in Display settings keeps the chosen option in view', async ({ page, baseURL }) => {
    await start()({ page, baseURL });
    await page.goto('/');
    await page.locator('[data-site-header] [data-display-settings-open]').tap();
    const dialog = page.getByRole('dialog', { name: 'Display settings' });
    await dialog.getByRole('radio', { name: '200%' }).check();
    const inView = await dialog.getByRole('radio', { name: '200%' }).evaluate((radio) => {
      const d = radio.closest('dialog')!.getBoundingClientRect();
      const r = radio.getBoundingClientRect();
      return r.top >= d.top && r.bottom <= d.bottom;
    });
    expect(inView).toBe(true);
  });

  test('the page behind an open window does not scroll', async ({ page, baseURL }) => {
    await start()({ page, baseURL });
    await page.goto('/');
    await page.locator('[data-site-header] [data-display-settings-open]').tap();
    await expect(page.getByRole('dialog', { name: 'Display settings' })).toBeVisible();
    await page.mouse.move(5, 5); // over the backdrop
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });

  test('form fields are at least 16 px, so iPhone Safari does not zoom in when one gets focus', async ({ page, baseURL }) => {
    await start({ aloud: 'on' })({ page, baseURL });
    const small: string[] = [];
    for (const path of ['/labs/', '/contact/']) {
      await page.goto(path);
      small.push(...(await page.locator('input:not([type=checkbox], [type=radio], [type=hidden]), select, textarea').evaluateAll((els) =>
        els.filter((el) => (el as HTMLElement).offsetParent !== null && parseFloat(getComputedStyle(el).fontSize) < 16)
          .map((el) => `${location.pathname} ${el.tagName.toLowerCase()} ${(el as HTMLElement).dataset ? Object.keys((el as HTMLElement).dataset).join(' ') : ''} ${getComputedStyle(el).fontSize}`))));
    }
    expect(small).toEqual([]);
  });

  test('the read-aloud controls are at least 44 px, like every other control', async ({ page, baseURL }) => {
    await start({ aloud: 'on' })({ page, baseURL });
    await page.goto('/');
    expect(await smallTargets(page)).toEqual([]);
  });

  test('jumping to a part of the page at 200% text leaves no large gap under the header', async ({ page, baseURL }) => {
    // The header is sized in px (80 px), but the scroll padding was 6rem, so at 200% text a jump landed 192 px down.
    await start({ text: '200' })({ page, baseURL });
    await page.goto('/');
    const padding = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop));
    expect(padding).toBeLessThanOrEqual(112);
    expect(padding).toBeGreaterThanOrEqual(81);
  });
});
