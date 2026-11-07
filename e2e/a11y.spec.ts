import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Pages every visitor can reach. Post pages are discovered from /posts/, so new posts are covered automatically
// (build with INCLUDE_DRAFTS=true when the fixtures only contain drafts).
const STATIC_PAGES = ['/', '/projects/', '/labs/', '/posts/', '/contact/', '/privacy/', '/accessibility/', '/glossary/', '/about/easy-read/', '/linkedin/callback/', '/404.html'];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// In forced-colours mode the browser replaces the author's colours, but axe still reads the author's values,
// so its colour-contrast rule reports false positives there. The rule runs in light and dark mode instead.
interface Mode {
  name: string;
  media: { colorScheme: 'light' | 'dark'; forcedColors: 'none' | 'active' };
  rules: string[];
  /** Display settings to start with, as if chosen in the panel. */
  prefs?: Record<string, string>;
}
const MODES: Mode[] = [
  { name: 'light', media: { colorScheme: 'light', forcedColors: 'none' }, rules: [] },
  { name: 'dark', media: { colorScheme: 'dark', forcedColors: 'none' }, rules: [] },
  { name: 'high-contrast', media: { colorScheme: 'light', forcedColors: 'none' }, rules: [], prefs: { theme: 'high-contrast' } },
  { name: 'forced-colours', media: { colorScheme: 'light', forcedColors: 'active' }, rules: ['color-contrast'] },
  {
    name: '200% text, wide spacing, narrow lines',
    media: { colorScheme: 'light', forcedColors: 'none' },
    rules: [],
    prefs: { text: '200', spacing: 'wide', measure: 'narrow' },
  },
];

async function prepare(page: Page, mode: Mode) {
  await page.emulateMedia(mode.media);
  if (mode.prefs) await page.addInitScript((value) => localStorage.setItem('a11y-prefs', value), JSON.stringify(mode.prefs));
}

/**
 * The Turnstile script must never load in tests: no network, no third-party code.
 * Every test here starts as a visitor who has already answered the welcome window, so it does not cover the page
 * (e2e/welcome.spec.ts tests the window itself).
 */
test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => localStorage.setItem('a11y-welcomed', '1'));
  await page.route('**/*', (route) => {
    const origin = new URL(route.request().url()).origin;
    return origin === baseURL ? route.continue() : route.abort();
  });
});

async function postPaths(page: Page): Promise<string[]> {
  await page.goto('/posts/');
  const hrefs = await page.locator('main a[href^="/posts/"]').evaluateAll((links) =>
    links.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
  return [...new Set(hrefs)].filter((href) => /^\/posts\/[^/]+\/$/.test(href));
}

for (const mode of MODES) {
  test.describe(`axe: ${mode.name}`, () => {
    for (const path of STATIC_PAGES) {
      test(`${path} has no WCAG 2.2 A/AA violations`, async ({ page }) => {
        await prepare(page, mode);
        await page.goto(path);
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules(mode.rules).analyze();
        expect(summarise(results.violations)).toEqual([]);
      });
    }

    test('post pages have no WCAG 2.2 A/AA violations', async ({ page }) => {
      await prepare(page, mode);
      const paths = await postPaths(page);
      const problems: string[] = [];
      for (const path of paths) {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules(mode.rules).analyze();
        problems.push(...summarise(results.violations).map((line) => `${path} ${line}`));
      }
      expect(problems).toEqual([]);
    });
  });
}

function summarise(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']): string[] {
  return violations.map((v) => `${v.id} (${v.impact ?? 'n/a'}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test('Labs filter shows which category is selected in forced-colours mode', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/labs/');
  const look = (selector: string) => page.locator(selector).first().evaluate((el) => {
    const style = getComputedStyle(el);
    return [style.color, style.backgroundColor, style.borderTopColor, style.borderTopWidth, style.outlineStyle].join('|');
  });
  const pressed = await look('[data-lab-category][aria-pressed="true"]');
  const notPressed = await look('[data-lab-category][aria-pressed="false"]');
  expect(pressed).not.toEqual(notPressed);
});

test('the first three Tab stops are skip to content, display settings and the accessibility statement', async ({ page }) => {
  await page.goto('/');
  const focused = () => page.evaluate(() => (document.activeElement as HTMLElement).textContent?.trim());
  await page.keyboard.press('Tab');
  expect(await focused()).toBe('Skip to content');
  await page.keyboard.press('Tab');
  expect(await focused()).toBe('Display settings');
  await page.keyboard.press('Enter');
  await expect(page.locator('#display-settings')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#display-settings')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Display settings' }).first()).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await focused()).toBe('Accessibility statement');
});

test('skip link is the first focus stop and moves focus to main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('href'))).toBe('#main');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
});

for (const path of ['/', '/labs/', '/posts/', '/contact/', '/privacy/', '/accessibility/', '/glossary/', '/about/easy-read/']) {
  test(`${path} reflows at 320 CSS px without horizontal scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(path);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(320);
  });

  test(`${path} still reflows at 320 CSS px with 200% text and wide spacing`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('a11y-prefs', JSON.stringify({ text: '200', spacing: 'wide' })));
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(path);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(320);
  });
}

test.describe('display settings', () => {
  test('open from the header, apply at once, are remembered, and close with Esc returning focus', async ({ page }) => {
    await page.goto('/');
    const opener = page.locator('header [data-display-settings-open]');
    const dialog = page.locator('#display-settings');
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('group', { name: 'Text size' })).toBeVisible();

    await dialog.getByLabel('200%').check();
    await dialog.getByLabel('Wide').check();
    await dialog.getByLabel('High contrast').check();
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-text', '200');
    await expect(root).toHaveAttribute('data-spacing', 'wide');
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(root).toHaveAttribute('data-contrast', 'high');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();

    await page.reload();
    await expect(root).toHaveAttribute('data-text', '200');
    await expect(root).toHaveAttribute('data-contrast', 'high');
  });

  test('reset goes back to the device settings and clears what was saved', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('a11y-prefs', JSON.stringify({ text: '150', theme: 'dark', motion: 'reduce' })));
    await page.goto('/');
    await page.locator('header [data-display-settings-open]').click();
    await page.getByRole('button', { name: 'Reset to my device settings' }).click();
    const root = page.locator('html');
    await expect(root).not.toHaveAttribute('data-text', /.*/);
    await expect(root).not.toHaveAttribute('data-motion', /.*/);
    expect(await page.evaluate(() => localStorage.getItem('a11y-prefs'))).toBeNull();
  });

  test('ignores saved values that are not on the allowed list', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('a11y-prefs', JSON.stringify({ text: '9999', theme: '<script>', spacing: 'wide' })));
    await page.goto('/');
    const root = page.locator('html');
    await expect(root).not.toHaveAttribute('data-text', /.*/);
    await expect(root).toHaveAttribute('data-spacing', 'wide');
    await expect(root).toHaveAttribute('data-theme', /^(light|dark)$/);
  });

  test('the header theme button still switches light and dark, and keeps the old setting working', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark')); // what the old toggle saved
    await page.goto('/');
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await page.locator('[data-theme-toggle]').click();
    await expect(root).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('a11y-prefs'))).toBe('{"theme":"light"}');
  });

  test('"Reduce motion" stops animations even when the device allows motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => localStorage.setItem('a11y-prefs', JSON.stringify({ motion: 'reduce' })));
    await page.goto('/');
    await page.waitForTimeout(500);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    expect(running).toBe(0);
  });
});

test('post pages have a breadcrumb, a summary and a "Listen" button', async ({ page }) => {
  const [path] = await postPaths(page);
  expect(path).toBeTruthy();
  await page.goto(path!);
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link')).toHaveText(['Home', 'Posts']);
  await expect(crumbs.locator('[aria-current="page"]')).toBeVisible();
  await expect(page.locator('[data-listen]')).toBeVisible();
  await expect(page.locator('[data-listen]')).toHaveAttribute('aria-pressed', 'false');
});

test('the main menu marks the current page', async ({ page }) => {
  await page.goto('/labs/');
  await expect(page.locator('nav[aria-label="Main"] a[aria-current="page"]')).toHaveText('Labs');
});

test('the greeting is marked as te reo Māori', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[lang="mi"]').first()).toHaveText('Kia ora');
});

test('no animation keeps running with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForTimeout(500);
  const running = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.id || a.constructor.name));
  expect(running).toEqual([]);
});

test('mobile menu opens, closes with Esc and returns focus to its button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  const toggle = page.locator('[data-menu-toggle]');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test.describe('contact form errors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact/');
    // The fixture build has no contact endpoint, so Send is disabled; validation runs before the endpoint check.
    await page.locator('[data-submit]').evaluate((button) => button.removeAttribute('disabled'));
  });

  test('an empty form lists every problem in a summary that takes focus', async ({ page }) => {
    await page.locator('[data-submit]').click();
    const summary = page.locator('[data-error-summary]');
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary.getByRole('link')).toHaveText([
      'Enter your name.',
      'Enter your email address.',
      'Enter your message.',
      'Tick the box to agree before sending.',
    ]);
    for (const field of ['name', 'email', 'message', 'consent']) {
      const input = page.locator(`[name="${field}"]`);
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toHaveAttribute('aria-describedby', `contact-${field}-error`);
      await expect(page.locator(`#contact-${field}-error`)).toBeVisible();
    }
    // The error state itself must also pass axe (contrast of the error colour, names, descriptions).
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(summarise(results.violations)).toEqual([]);
  });

  test('a summary link moves focus to its field, and fixing the field clears its message', async ({ page }) => {
    await page.locator('[data-submit]').click();
    await page.locator('[data-error-summary]').getByRole('link', { name: 'Enter your name.' }).click();
    await expect(page.locator('[name="name"]')).toBeFocused();
    await page.keyboard.type('Ada');
    await expect(page.locator('[name="name"]')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#contact-name-error')).toBeHidden();
  });

  test('an invalid email address gets its own message', async ({ page }) => {
    await page.locator('[name="name"]').fill('Ada');
    await page.locator('[name="email"]').fill('not-an-email');
    await page.locator('[name="message"]').fill('Hello, this is long enough.');
    await page.locator('[name="consent"]').check();
    await page.locator('[data-submit]').click();
    await expect(page.locator('[data-error-summary]').getByRole('link')).toHaveText([
      'Enter an email address in the format name@example.com.',
    ]);
  });
});

test('pages make no requests to other origins', async ({ page, baseURL }) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const origin = new URL(request.url()).origin;
    if (origin !== baseURL) foreign.push(request.url());
  });
  for (const path of ['/', '/labs/', '/posts/', '/contact/', '/privacy/']) {
    await page.goto(path);
  }
  expect(foreign).toEqual([]);
});

test('the home page welcomes visitors and points to the ways to adjust the site', async ({ page }) => {
  await page.goto('/');
  const welcome = page.getByRole('region', { name: 'Made for everyone' });
  await expect(welcome).toBeVisible();
  await expect(welcome.getByRole('link', { name: 'Easy Read version' })).toHaveAttribute('href', '/about/easy-read/');
  await expect(welcome.getByRole('link', { name: 'Accessibility statement' })).toHaveAttribute('href', '/accessibility/');
  await welcome.getByRole('button', { name: 'Display settings' }).click();
  await expect(page.locator('#display-settings')).toBeVisible();
});

test('on wide screens the header names the display settings button in words', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('header [data-display-settings-open]')).toContainText('Display settings');
});
