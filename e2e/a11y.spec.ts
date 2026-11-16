import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cutOffAtTheRight, smallTargets } from './helpers';

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

test('the Labs summary says each number once, and the result count uses the right plural', async ({ page }) => {
  await page.goto('/labs/');
  const summary = (await page.locator('[data-lab-summary]').textContent())!.replace(/\s+/g, ' ').trim();
  expect(summary).toMatch(/^\d+ live, \d+ in testing, \d+ experiments? in total$/);
  const counter = page.locator('[data-lab-count]');
  await expect(counter).not.toContainText(/1 experiments/);
  await page.getByRole('searchbox', { name: 'Search experiments' }).fill('zzzz-no-match');
  await expect(counter).toHaveText(/^Showing 0 of \d+ experiments?$/);
  await page.getByRole('searchbox', { name: 'Search experiments' }).fill('');
  const total = await page.locator('[data-lab-item]').count();
  await expect(counter).toHaveText(total === 1 ? 'Showing 1 of 1 experiment' : `Showing ${total} of ${total} experiments`);
});

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

for (const path of ['/', '/labs/', '/projects/', '/posts/', '/contact/', '/privacy/', '/accessibility/', '/glossary/', '/about/easy-read/']) {
  test(`${path} reflows at 320 CSS px without horizontal scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(path);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(320);
    expect(await cutOffAtTheRight(page), 'nothing may be cut off at the right edge').toEqual([]);
  });

  test(`${path} still reflows at 320 CSS px with 200% text and wide spacing`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('a11y-prefs', JSON.stringify({ text: '200', spacing: 'wide' })));
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(path);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(320);
    expect(await cutOffAtTheRight(page), 'nothing may be cut off at the right edge').toEqual([]);
  });
}

test('at the normal text size on a desktop, every button label stays on one line', async ({ page }) => {
  // Buttons may wrap when they would not fit (200% text on a phone), but never just to make room for the text beside
  // them: "Send message" once wrapped next to the Turnstile note.
  await page.setViewportSize({ width: 1280, height: 900 });
  const tall: string[] = [];
  for (const path of ['/', '/labs/', '/projects/', '/posts/', '/contact/', '/about/easy-read/']) {
    await page.goto(path);
    for (const button of await page.locator('main .btn:visible').all()) {
      const box = await button.boundingBox();
      if (box && box.height > 50) tall.push(`${path}: "${(await button.innerText()).trim()}" is ${Math.round(box.height)} px tall`);
    }
  }
  expect(tall).toEqual([]);
});

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

test('"Copy link" says what happened in a status message, so a screen reader announces it', async ({ page, context }) => {
  // A screen reader does not announce a change to the text of a button that already has focus.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const [path] = await postPaths(page);
  expect(path).toBeTruthy();
  await page.goto(path!);
  const status = page.locator('[data-copy-status]');
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveText('');
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(status).toHaveText('Link copied');
  await expect(status).toHaveText('', { timeout: 5000 }); // cleared with the button label
});

test('the main menu marks the current page', async ({ page }) => {
  await page.goto('/labs/');
  await expect(page.locator('nav[aria-label="Main"] a[aria-current="page"]')).toHaveText('Labs');
});

test('the greeting is marked as te reo Māori', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[lang="mi"]').first()).toHaveText('Kia ora');
});

test('company and institution names carry a valid language tag when they have one', async ({ page }) => {
  await page.goto('/');
  // Every language tag in the experience timeline and the quick facts follows the rule the database enforces.
  const tags = await page.locator('#experience [lang], #about [lang]').evaluateAll((els) => els.map((el) => el.getAttribute('lang')));
  for (const tag of tags) expect(tag).toMatch(/^[a-z]{2,3}(-[A-Z]{2})?$/);
  // The seed content (used in CI) marks one Portuguese company name, so a screen reader pronounces it in Portuguese.
  if (process.env.CONTENT_SOURCE === 'fixtures') {
    await expect(page.locator('#experience [lang="pt-BR"]')).toHaveText('Drogaria Araujo');
    await expect(page.locator('#experience').getByText('Redvespa Consultants')).not.toHaveAttribute('lang', /.*/);
  }
});

test('durations on the home page are in whole words, not "yrs" or "mo"', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/\b\d+\s*(yrs?|mo)\b/);
  await expect(page.locator('#experience').getByText(/\b\d+ (years?|months?)\b/).first()).toBeVisible();
});

test.describe('cards read heading first', () => {
  // A screen reader user who jumps from heading to heading (the H key) lands on the card's name and hears its status,
  // category and date straight after it. Those used to come before the heading, so they were skipped.
  for (const [path, selector] of [['/', 'article[data-card]'], ['/labs/', 'article[data-card]'], ['/projects/', 'article[data-card]'], ['/posts/', 'article[data-card]']] as const) {
    test(`${path}: each card's heading comes before its details, in the page and on screen`, async ({ page }) => {
      await page.goto(path);
      const cards = page.locator(selector);
      const count = await cards.count();
      // The seed (CI) has cards on every one of these pages; real content may not have posts yet.
      if (process.env.CONTENT_SOURCE === 'fixtures') expect(count, 'the page should show at least one card').toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const order = await cards.nth(i).evaluate((card) => {
          const heading = card.querySelector('h2, h3')!;
          const meta = card.querySelector('[data-card-meta]')!;
          return {
            headingFirstInPage: Boolean(heading.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING),
            headingFirstOnScreen: heading.getBoundingClientRect().top <= meta.getBoundingClientRect().top,
            textBeforeHeading: [...card.querySelectorAll('*')]
              .filter((el) => el.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING && !el.contains(heading))
              .filter((el) => !el.closest('[aria-hidden="true"]'))
              .map((el) => [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent!.trim()).join(''))
              .join('').trim(),
          };
        });
        expect(order).toEqual({ headingFirstInPage: true, headingFirstOnScreen: true, textBeforeHeading: '' });
      }
    });
  }

  test('no heading name repeats "(opens in a new tab)"; the repository link still says so', async ({ page }) => {
    for (const path of ['/', '/projects/', '/labs/']) {
      await page.goto(path);
      for (const name of await page.locator('main :is(h1, h2, h3, h4)').allTextContents()) expect(name).not.toContain('new tab');
    }
    await page.goto('/projects/');
    for (const link of await page.locator('article[data-card] :is(h2, h3) a[target="_blank"]').all()) {
      await expect(link).toHaveAccessibleDescription('Opens on GitHub in a new tab');
    }
  });

  test('lab card links say which lab they belong to, and start with the words on screen', async ({ page }) => {
    await page.goto('/labs/');
    const links = page.locator('article[data-lab] a').filter({ hasText: /^(Code|Read notes)/ });
    if (process.env.CONTENT_SOURCE === 'fixtures') expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all()) {
      const name = await link.evaluate((a) => a.closest('article')!.querySelector('h2, h3')!.textContent!.trim());
      const visible = (await link.evaluate((a) => [...a.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim()));
      const accessible = (await link.textContent())!.replace(/\s+/g, ' ').trim();
      expect(accessible.startsWith(visible)).toBe(true);
      expect(accessible).toContain(name);
    }
  });
});

test('the availability line comes straight after the main heading', async ({ page }) => {
  // Someone who jumps to the h1 hears whether Carlos is available without reading back up the page.
  await page.goto('/');
  const next = await page.locator('main h1').evaluate((h1) => h1.nextElementSibling?.hasAttribute('data-availability') ?? false);
  const shown = await page.locator('main [data-availability]').count();
  expect(next || shown === 0).toBe(true);
  if (process.env.CONTENT_SOURCE === 'fixtures') expect(next).toBe(true); // the seed profile is available
});

test.describe('statuses read as sentences', () => {
  /** The text a screen reader reads: screen-reader-only text included, anything aria-hidden left out. */
  const spoken = (page: Page, selector: string) =>
    page.locator(selector).evaluateAll((els) => els.map((el) => {
      const copy = el.cloneNode(true) as Element;
      copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
    }));

  test('certifications say "Status:" or "Progress:" after the name', async ({ page }) => {
    await page.goto('/');
    const items = await spoken(page, 'section[aria-labelledby="now-title"] li');
    for (const item of items) expect(item).toMatch(/\. (Status|Progress): \S/);
  });

  test('a status pill and the text beside it are separated', async ({ page }) => {
    await page.goto('/');
    // e.g. "Self-hosted Always changing" used to run together; the two parts must be separated by a full stop.
    const footers = await page.locator('section[aria-labelledby="now-title"] article > p:last-child').evaluateAll((els) =>
      els.map((p) => {
        const parts = [...p.children].filter((c) => !c.classList.contains('sr-only')).map((c) => c.textContent!.replace(/\s+/g, ' ').trim());
        return { parts, text: (p.textContent ?? '').replace(/\s+/g, ' ').trim() };
      }));
    for (const { parts, text } of footers) {
      if (parts.length === 2) expect(text).toBe(`${parts[0]}. ${parts[1]}`);
    }
    for (const line of await spoken(page, '#experience header > p:last-child')) {
      expect(line).toMatch(/^.+(\d{4}|Present)\. \d+ (year|month)/);
    }
    for (const line of await spoken(page, '#experience li li > p:first-child')) {
      if (line.includes('In progress')) expect(line).toMatch(/\. In progress/);
    }
  });

  test('the hero figure says "Business and Technology", and the steps are numbered once', async ({ page }) => {
    await page.goto('/');
    expect((await spoken(page, 'main figure'))[0]).toContain('Business and Technology');
    for (const step of await spoken(page, 'section[aria-labelledby="spectrum-title"] ol > li')) expect(step).not.toMatch(/^\d/);
  });
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
      await expect(input).toHaveAttribute('aria-describedby', new RegExp(`(^| )contact-${field}-error( |$)`));
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

  test('before anything goes wrong, no field announces "Error"', async ({ page }) => {
    // The hidden error line used to hold a fixed "Error: " prefix, so every field was described as "Error:" from the start.
    for (const field of ['name', 'email', 'topic', 'message', 'consent']) {
      await expect(page.locator(`[name="${field}"]`)).not.toHaveAccessibleDescription(/Error/);
    }
  });

  test('the message field announces its limit, and still its error when there is one', async ({ page }) => {
    const message = page.getByRole('textbox', { name: 'Message' });
    await expect(message).toHaveAccessibleDescription('Up to 5,000 characters.');
    // The visible counter changes on every key press, so it is not a live region and is not read out as "0 / 5000".
    await expect(page.locator('[data-counter]')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('[data-counter]')).not.toHaveAttribute('aria-live', /.*/);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(message).toHaveAccessibleDescription(/^Up to 5,000 characters\. Error: Enter your message\.$/);
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

// ---------------------------------------------------------------------------
// Fixes from the site-wide accessibility review: focus indicators, text spacing, short screens, reading order.
// ---------------------------------------------------------------------------

/** Tabs through a page and lists every stop that shows no focus indicator, on itself or on the card around it. */
async function stopsWithoutFocusIndicator(page: Page): Promise<string[]> {
  const missing: string[] = [];
  let first: string | undefined;
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const outline = (node: Element) => {
        const style = getComputedStyle(node);
        return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
      };
      // A card has a resting shadow, so only a real outline on it counts. The focused control may use a ring drawn with box-shadow.
      const card = el.closest('.card');
      const name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return {
        key: `${el.tagName}|${name}|${el.getAttribute('href')}`,
        label: `${el.tagName.toLowerCase()} "${name}"`,
        shows: outline(el) || getComputedStyle(el).boxShadow !== 'none' || (card ? outline(card) : false),
      };
    });
    if (!stop || stop.key === first) break;
    first ??= stop.key;
    if (!stop.shows) missing.push(stop.label);
  }
  return missing;
}

for (const path of ['/', '/labs/', '/posts/', '/contact/']) {
  test(`${path}: every Tab stop shows where the keyboard focus is`, async ({ page }) => {
    await page.goto(path);
    expect(await stopsWithoutFocusIndicator(page)).toEqual([]);
  });
}

test('a post card rings the whole card when its link has keyboard focus', async ({ page }) => {
  await page.goto('/posts/');
  const card = page.locator('article[data-post]').first();
  await expect(card).toBeVisible();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => !!document.activeElement?.closest('article[data-post] :is(h2, h3)'))) break;
  }
  const ring = await card.evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBeGreaterThanOrEqual(2);
});

test('any card that is one big link (a post, a repository) rings the whole card on keyboard focus', async ({ page }) => {
  await page.goto('/contact/');
  await page.evaluate(() => {
    const card = document.createElement('article');
    card.className = 'card card-interactive relative';
    card.innerHTML = '<a href="#x" data-card-link class="after:absolute after:inset-0">A stretched link</a>';
    document.body.prepend(card);
  });
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-card-link'))).toBe(true);
  const ring = await page.locator('article.card-interactive').evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBeGreaterThanOrEqual(2);
});

test.describe('text spacing and wide settings on a phone', () => {
  test('post pages reflow at 320 CSS px, also with 200% text and wide spacing', async ({ page }) => {
    const paths = await postPaths(page);
    expect(paths.length).toBeGreaterThan(0);
    await page.setViewportSize({ width: 320, height: 800 });
    for (const path of paths) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} default`).toBeLessThanOrEqual(320);
      expect(await cutOffAtTheRight(page), `${path} default: nothing cut off`).toEqual([]);
    }
    await page.addInitScript(() => localStorage.setItem('a11y-prefs', JSON.stringify({ text: '200', spacing: 'wide' })));
    for (const path of paths) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} 200% and wide`).toBeLessThanOrEqual(320);
      expect(await cutOffAtTheRight(page), `${path} 200% and wide: nothing cut off`).toEqual([]);
    }
  });

  // WCAG 1.4.12: a reader's own style sheet may set these spacings, and nothing may be cut off or scroll sideways.
  test('every page copes with the WCAG text spacing overrides at 320 CSS px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const paths = [...STATIC_PAGES, ...(await postPaths(page))];
    const wide: string[] = [];
    for (const path of paths) {
      await page.goto(path);
      // The site's strict content security policy blocks an injected <style>, but not a style sheet built by script.
      await page.evaluate((css) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      }, '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important } p { margin-bottom: 2em !important }');
      // Guard: the override really is in force, so this test cannot pass by doing nothing.
      expect(await page.evaluate(() => getComputedStyle(document.body).letterSpacing), `${path}: spacing applied`).not.toBe('normal');
      if ((await page.evaluate(() => document.documentElement.scrollWidth)) > 320) wide.push(path);
      for (const cut of await cutOffAtTheRight(page)) wide.push(`${path}: ${cut}`);
    }
    expect(wide).toEqual([]);
  });
});

test.describe('the header on short screens', () => {
  // At 400% zoom a laptop shows about 320 x 200 CSS px, and a phone on its side about 667 x 375.
  test('scrolls away with the page when the screen is short, so it never covers the text', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 200 });
    await page.goto('/');
    const header = page.locator('body > header');
    expect(await header.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
    expect(await header.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
    // Anchor jumps and focus do not keep a gap for a header that is no longer there.
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop))).toBeLessThan(40);
  });

  test('stays in view on a normal screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const header = page.locator('body > header');
    expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
    expect(await header.evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
  });
});

for (const [name, viewport] of [['phone', { width: 390, height: 800 }], ['desktop', { width: 1280, height: 800 }]] as const) {
  test(`on a post the text comes before the sidebar, in the page and on screen (${name})`, async ({ page }) => {
    const [path] = await postPaths(page);
    expect(path).toBeTruthy();
    await page.setViewportSize(viewport);
    await page.goto(path!);
    const order = await page.evaluate(() => {
      const text = document.querySelector('[data-listen-source]')!;
      const sidebar = document.querySelector('aside:has([data-copy])')!; // the share, listen and contents column
      const t = text.getBoundingClientRect();
      const s = sidebar.getBoundingClientRect();
      return {
        textFirstInPage: Boolean(text.compareDocumentPosition(sidebar) & Node.DOCUMENT_POSITION_FOLLOWING),
        sidebarAfterOnScreen: s.top >= t.bottom - 1 || s.left >= t.right - 1, // below the text, or beside it on its right
      };
    });
    expect(order.textFirstInPage).toBe(true);
    expect(order.sidebarAfterOnScreen).toBe(true);
  });
}

// ---------------------------------------------------------------------------
// Easier by default: text size, tap targets and how long things move (review items 5, 6 and 8).
// ---------------------------------------------------------------------------

test('nothing moves on its own for more than five seconds (WCAG 2.2.2)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const long = await page.evaluate(() => document.getAnimations()
    .map((a) => ({ name: (a as CSSAnimation).animationName ?? '', end: a.effect?.getComputedTiming().endTime as number }))
    .filter((a) => a.end === Infinity || a.end > 5000));
  expect(long).toEqual([]);
});

async function pagesAndPosts(page: Page): Promise<string[]> {
  return [...STATIC_PAGES, ...(await postPaths(page))];
}

test('no visible text is smaller than 14 px', async ({ page }) => {
  const small: string[] = [];
  for (const path of await pagesAndPosts(page)) {
    await page.goto(path);
    const found = await page.evaluate(() => {
      const list: string[] = [];
      document.querySelectorAll('body *').forEach((el) => {
        if (el.closest('svg, script, style, dialog:not([open]), [hidden]')) return;
        const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0);
        const box = el.getBoundingClientRect();
        if (!own || box.width <= 1 || box.height <= 1) return; // text that is only for screen readers is 1 px wide
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 14) list.push(`${size}px "${(el.textContent ?? '').trim().slice(0, 30)}"`);
      });
      return list;
    });
    small.push(...found.slice(0, 4).map((line) => `${path} ${line}`));
  }
  expect(small).toEqual([]);
});

// WCAG asks for 24 px; 44 px is the size that suits a tremor or a thumb. The "Bigger buttons and links" setting goes to 48 px.
test('every control that stands on its own is at least 44 px tall and wide', async ({ page }) => {
  const small: string[] = [];
  for (const path of await pagesAndPosts(page)) {
    await page.goto(path);
    const found = await smallTargets(page);
    small.push(...found.map((line) => `${path} ${line}`));
  }
  expect(small).toEqual([]);
});

test.describe('signposts: a visitor can tell the site is built for people who cannot see the screen well', () => {
  test('the home page note names screen readers, the keyboard and zoom, and links to the screen reader guide', async ({ page }) => {
    await page.goto('/');
    const note = page.getByRole('region', { name: 'Made for everyone' });
    await expect(note).toContainText('screen reader');
    await expect(note).toContainText('keyboard');
    await expect(note).toContainText('read aloud');
    await expect(note.getByRole('link', { name: 'How to use it with a screen reader' })).toHaveAttribute('href', '/accessibility/#screen-reader');
  });

  test('the statement has a screen reader guide and a guide for people who find the screen hard to read, before the long lists', async ({ page }) => {
    await page.goto('/accessibility/');
    const headings = await page.locator('main h2').allInnerTexts();
    const at = (name: string) => headings.indexOf(name);
    expect(at('Using a screen reader?')).toBeGreaterThan(-1);
    expect(at('If the screen is hard to read')).toBeGreaterThan(-1);
    expect(at('Using a screen reader?')).toBeLessThan(at('What you can do on this site'));
    expect(at('If the screen is hard to read')).toBeLessThan(at('What you can do on this site'));

    // The links from the home page and from the short version land on them.
    await expect(page.locator('#screen-reader')).toHaveText('Using a screen reader?');
    await expect(page.locator('#hard-to-read')).toHaveText('If the screen is hard to read');
    const short = page.locator('main .card').first();
    await expect(short.getByRole('link', { name: 'Using a screen reader?' })).toHaveAttribute('href', '#screen-reader');
    await expect(short.getByRole('link', { name: 'If the screen is hard to read' })).toHaveAttribute('href', '#hard-to-read');
  });

  test('the screen reader guide does not claim testing that has not been done', async ({ page }) => {
    await page.goto('/accessibility/');
    const guide = page.locator('section[aria-labelledby="screen-reader"]');
    await expect(guide).toContainText('not yet tested');
    // It names the built-in screen readers, for people who do not know their device has one.
    const hard = page.locator('section[aria-labelledby="hard-to-read"]');
    for (const name of ['VoiceOver', 'TalkBack', 'Narrator']) await expect(hard).toContainText(name);
  });
});
