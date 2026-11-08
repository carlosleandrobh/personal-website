import { expect, test, type Page } from '@playwright/test';
import { GLOSSARY } from '../src/lib/glossary';

// "Words on this page": each page lists the abbreviations and technical terms it uses, with plain meanings, taken from
// the glossary (src/lib/glossary.ts). A visitor never has to leave the page or hover for a tooltip to find out what HSQE is.

test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => localStorage.setItem('a11y-welcomed', '1'));
  await page.route('**/*', (route) => {
    const origin = new URL(route.request().url()).origin;
    return origin === baseURL ? route.continue() : route.abort();
  });
});

const wordsList = (page: Page) => page.getByRole('region', { name: 'Words on this page' });

test('the home page explains the abbreviations it uses, in a list on the page', async ({ page }) => {
  await page.goto('/');
  const list = wordsList(page);
  await expect(list).toBeVisible();
  // Whatever the content is (fixtures or the live site), every glossary abbreviation the page uses must be in the list.
  const listed = new Set(
    (await list.locator('[data-word]').allInnerTexts()).flatMap((term) => term.split('/').map((part) => part.trim())),
  );
  const used = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.parentElement?.closest('[data-words], pre, script, style, .sr-only, [aria-hidden="true"]')) parts.push(node.textContent ?? '');
    }
    return parts.join(' ').match(/\b(?:[A-Z]-)?[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)*\b/g) ?? [];
  });
  const missing = [...new Set(used)].filter((token) => KNOWN.has(token) && !listed.has(token));
  expect(missing).toEqual([]);
  for (const meaning of await list.locator('dd').allInnerTexts()) expect(meaning.trim().length).toBeGreaterThan(10);
});

test('it lists only words that really appear on the page, and nothing from its own list', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    // The page's own words, one text node at a time, so neighbouring chips do not run together.
    const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.parentElement?.closest('[data-words], pre, script, style, .sr-only')) parts.push(node.textContent ?? '');
    }
    const text = parts.join(' ');
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const listed = [...document.querySelectorAll('[data-words] [data-word]')].map((el) => el.textContent ?? '');
    return { listed: listed.length, missing: listed.filter((word) => !new RegExp(escape(word), 'i').test(text)) };
  });
  expect(result.listed).toBeGreaterThan(8); // the list exists and is not empty
  expect(result.missing).toEqual([]);
});

test('the list is plain text: its only link goes to the full glossary', async ({ page }) => {
  await page.goto('/');
  const links = wordsList(page).getByRole('link');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveAttribute('href', '/glossary/');
});

test('a page that uses none of the words shows no list, and the glossary page has none of its own', async ({ page }) => {
  await page.goto('/404.html');
  await expect(wordsList(page)).toBeHidden();
  await page.goto('/glossary/');
  await expect(page.locator('[data-words]')).toHaveCount(0);
});

test('the list is read aloud with the rest of the page', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.__spoken = [] as string[];
    speechSynthesis.speak = (u: SpeechSynthesisUtterance) => { w.__spoken.push(u.text); };
    speechSynthesis.cancel = () => {};
  });
  await page.goto('/');
  await page.locator('header [data-display-settings-open]').click();
  await page.locator('#display-settings').getByLabel('Show a Listen button on every page').check();
  await page.locator('#display-settings').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('region', { name: 'Read aloud' }).getByRole('button', { name: 'Listen to this page' }).click();
  await expect.poll(async () => (await page.evaluate(() => (window as any).__spoken as string[])).join(' ')).toContain('Short meanings');
});

// Every abbreviation on the main pages must be in the glossary, or be a name, a place or a word everyone knows. When this
// fails after a content change, add the new term to src/lib/glossary.ts (or to NOT_JARGON below if it is a name).
const NOT_JARGON = new Set([
  'IBM', 'NZ', 'CV', 'PDF', 'IT', 'HR', 'IP', 'TOTVS', 'SETHOS', 'PUC', 'RM', 'VE', 'UTC', 'OK',
]);
const KNOWN = new Set(GLOSSARY.flatMap((g) => g.term.split('/').map((part) => part.trim())));

test('every abbreviation on the main pages is in the glossary', async ({ page }) => {
  await page.goto('/posts/');
  const posts = (await page.locator('main a[href^="/posts/"]').evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? '')))
    .filter((href) => /^\/posts\/[^/]+\/$/.test(href));
  const unknown = new Set<string>();
  for (const path of ['/', '/labs/', '/projects/', '/posts/', '/about/easy-read/', ...new Set(posts)]) {
    await page.goto(path);
    const tokens = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT);
      const parts: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.parentElement?.closest('[data-words], pre, script, style, .sr-only')) parts.push(node.textContent ?? '');
      }
      return parts.join(' ').match(/\b(?:[A-Z]-)?[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)*\b/g) ?? [];
    });
    for (const token of tokens) if (!KNOWN.has(token) && !NOT_JARGON.has(token)) unknown.add(`${token} (${path})`);
  }
  expect([...unknown].sort()).toEqual([]);
});
