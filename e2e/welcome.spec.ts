import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The first-visit welcome window, the "Read aloud" player and the "Bigger buttons and links" setting.
// Unlike a11y.spec.ts, these tests start as a brand-new visitor: nothing is saved in the browser.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const TITLE = 'Welcome! This site can adapt to you.';
const CHOICES = [
  'Read the pages aloud to me',
  'Larger text and stronger contrast',
  'Simpler words (Easy Read)',
  'Less movement and animation',
  'Bigger buttons and links',
];

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) => {
    const origin = new URL(route.request().url()).origin;
    return origin === baseURL ? route.continue() : route.abort();
  });
});

/** Replaces the browser's text-to-speech with a recorder, so tests can see what would be spoken. */
async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__spoken = [] as string[];
    w.__queue = [] as SpeechSynthesisUtterance[];
    speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      w.__spoken.push(utterance.text);
      w.__queue.push(utterance);
    };
    speechSynthesis.cancel = () => { w.__queue.length = 0; };
  });
}

const spoken = (page: Page) => page.evaluate(() => (window as any).__spoken as string[]);
const welcomeWindow = (page: Page) => page.getByRole('dialog', { name: TITLE });

test.describe('welcome window', () => {
  test('opens on the first visit, names itself and puts focus on its title', async ({ page }) => {
    await page.goto('/');
    const dialog = welcomeWindow(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: TITLE })).toBeFocused();
    await expect(dialog.getByRole('checkbox')).toHaveCount(CHOICES.length);
    for (const label of CHOICES) await expect(dialog.getByRole('checkbox', { name: label })).not.toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Use my choices' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Continue without changes' })).toBeVisible();
    await expect(dialog).toContainText('Using a screen reader or only the keyboard?');
  });

  test('is reachable in a sensible order with the keyboard alone', async ({ page }) => {
    await page.goto('/');
    await expect(welcomeWindow(page)).toBeVisible();
    const focusedName = () => page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement;
      return el.labels?.[0]?.textContent?.trim() ?? el.textContent?.trim();
    });
    const order: (string | undefined)[] = [];
    for (let i = 0; i < CHOICES.length + 2; i++) {
      await page.keyboard.press('Tab');
      order.push(await focusedName());
    }
    expect(order).toEqual([...CHOICES, 'Use my choices', 'Continue without changes']);
    // The window is modal: further Tabs may leave for the browser's own controls, but never reach the page behind it.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('header, main, footer'))).toBe(false);
    }
  });

  test('does not open again once it has been answered', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('a11y-welcomed', '1'));
    await page.goto('/');
    await expect(page.locator('#welcome-window')).toBeHidden();
  });

  test('does not open on the accessibility statement, Easy Read or the LinkedIn page', async ({ page }) => {
    for (const path of ['/accessibility/', '/about/easy-read/', '/linkedin/callback/']) {
      await page.goto(path);
      await expect(page.locator('#welcome-window'), path).toHaveCount(0);
    }
  });

  test('shows the effect of each choice at once, and "Use my choices" keeps them', async ({ page }) => {
    await page.goto('/');
    const dialog = welcomeWindow(page);
    const root = page.locator('html');

    await dialog.getByRole('checkbox', { name: 'Larger text and stronger contrast' }).check();
    await expect(root).toHaveAttribute('data-text', '150');
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(root).toHaveAttribute('data-contrast', 'high');

    await dialog.getByRole('checkbox', { name: 'Larger text and stronger contrast' }).uncheck();
    await expect(root).not.toHaveAttribute('data-text', /.*/);
    await expect(root).not.toHaveAttribute('data-contrast', /.*/);

    await dialog.getByRole('checkbox', { name: 'Larger text and stronger contrast' }).check();
    await dialog.getByRole('checkbox', { name: 'Less movement and animation' }).check();
    await dialog.getByRole('checkbox', { name: 'Bigger buttons and links' }).check();
    await expect(root).toHaveAttribute('data-motion', 'reduce');
    await expect(root).toHaveAttribute('data-targets', 'large');

    await dialog.getByRole('button', { name: 'Use my choices' }).click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('a11y-welcomed'))).toBe('1');

    await page.reload();
    await expect(page.locator('#welcome-window')).toBeHidden();
    await expect(root).toHaveAttribute('data-text', '150');
    await expect(root).toHaveAttribute('data-motion', 'reduce');
    await expect(root).toHaveAttribute('data-targets', 'large');
  });

  test('"Continue without changes" undoes the preview, saves nothing and is remembered', async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('a11y-welcomed')) localStorage.setItem('a11y-prefs', JSON.stringify({ spacing: 'wide' }));
    });
    await page.goto('/');
    const dialog = welcomeWindow(page);
    const root = page.locator('html');
    await dialog.getByRole('checkbox', { name: 'Larger text and stronger contrast' }).check();
    await expect(root).toHaveAttribute('data-text', '150');
    await dialog.getByRole('button', { name: 'Continue without changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(root).not.toHaveAttribute('data-text', /.*/);
    await expect(root).toHaveAttribute('data-spacing', 'wide'); // what was saved before is untouched
    expect(await page.evaluate(() => localStorage.getItem('a11y-prefs'))).toBe('{"spacing":"wide"}');
    expect(await page.evaluate(() => localStorage.getItem('a11y-welcomed'))).toBe('1');
  });

  test('Esc counts as "Continue without changes"', async ({ page }) => {
    await page.goto('/');
    const dialog = welcomeWindow(page);
    await dialog.getByRole('checkbox', { name: 'Less movement and animation' }).check();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-motion', /.*/);
    expect(await page.evaluate(() => localStorage.getItem('a11y-welcomed'))).toBe('1');
    expect(await page.evaluate(() => localStorage.getItem('a11y-prefs'))).toBeNull();
  });

  test('"Simpler words" takes the visitor to the Easy Read version', async ({ page }) => {
    await page.goto('/');
    const dialog = welcomeWindow(page);
    await dialog.getByRole('checkbox', { name: 'Simpler words (Easy Read)' }).check();
    await dialog.getByRole('button', { name: 'Use my choices' }).click();
    await expect(page).toHaveURL(/\/about\/easy-read\/$/);
    await expect(page.locator('#welcome-window')).toHaveCount(0);
  });

  test('the reading option is left out when the browser cannot speak', async ({ page }) => {
    await page.addInitScript(() => { delete (window as any).speechSynthesis; });
    await page.goto('/');
    const dialog = welcomeWindow(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('checkbox')).toHaveCount(CHOICES.length - 1);
    await expect(dialog.getByRole('checkbox', { name: 'Read the pages aloud to me' })).toHaveCount(0);
  });

  for (const [name, media, prefs] of [
    ['light', { colorScheme: 'light' }, {}],
    ['dark', { colorScheme: 'dark' }, {}],
    ['high contrast', { colorScheme: 'light' }, { theme: 'high-contrast' }],
    ['200% text', { colorScheme: 'light' }, { text: '200', spacing: 'wide' }],
  ] as const) {
    test(`has no WCAG 2.2 A/AA violations (${name})`, async ({ page }) => {
      await page.emulateMedia(media);
      await page.addInitScript((value) => localStorage.setItem('a11y-prefs', value), JSON.stringify(prefs));
      await page.goto('/');
      await expect(welcomeWindow(page)).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }

  test('fits a 320 px screen at 200% text without sideways scrolling, and its buttons can be reached', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('a11y-prefs', JSON.stringify({ text: '200', spacing: 'wide' })));
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    const dialog = welcomeWindow(page);
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    await dialog.getByRole('button', { name: 'Continue without changes' }).focus(); // scrolls inside the window
    await expect(dialog.getByRole('button', { name: 'Continue without changes' })).toBeInViewport();
  });
});

test.describe('reading aloud', () => {
  test('starts only when the visitor presses "Use my choices", and can be paused, resumed and stopped', async ({ page }) => {
    await fakeSpeech(page);
    await page.goto('/');
    const dialog = welcomeWindow(page);
    await expect(dialog).toBeVisible();
    expect(await spoken(page)).toEqual([]); // nothing speaks by itself

    await dialog.getByRole('checkbox', { name: 'Read the pages aloud to me' }).check();
    expect(await spoken(page)).toEqual([]); // ticking the box is not enough
    await dialog.getByRole('button', { name: 'Use my choices' }).click();

    const player = page.getByRole('region', { name: 'Read aloud' });
    await expect(player).toBeVisible();
    await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(3);
    // It reads the page content (the main heading is included), not the menu.
    const headline = (await page.locator('main h1').innerText()).replace(/\s+/g, ' ').trim();
    expect((await spoken(page)).some((text) => text.includes(headline))).toBe(true);
    expect((await spoken(page)).join(' ')).not.toContain('Skip to content');
    const pause = player.getByRole('button', { name: 'Pause' });
    await expect(pause).toBeVisible();

    await pause.click();
    await expect(player.getByRole('button', { name: 'Resume' })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__queue.length)).toBe(0);

    const before = (await spoken(page)).length;
    await player.getByRole('button', { name: 'Resume' }).click();
    await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(before);

    await player.getByRole('button', { name: 'Stop' }).click();
    await expect(player.getByRole('button', { name: 'Listen to this page' })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__queue.length)).toBe(0);
  });

  test('marks the paragraph being read, and the speed setting is used and remembered', async ({ page }) => {
    await fakeSpeech(page);
    await page.addInitScript(() => {
      localStorage.setItem('a11y-welcomed', '1');
      // Only the first time: the page saves the speed later, and a reload must not overwrite it.
      if (!localStorage.getItem('a11y-prefs')) localStorage.setItem('a11y-prefs', JSON.stringify({ aloud: 'on' }));
    });
    await page.goto('/');
    const player = page.getByRole('region', { name: 'Read aloud' });
    await expect(player).toBeVisible(); // the choice is remembered, but nothing is spoken yet
    expect(await spoken(page)).toEqual([]);

    await player.getByLabel('Speed').selectOption('1.25');
    await player.getByRole('button', { name: 'Listen to this page' }).click();
    await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as any).__queue[0].rate)).toBe(1.25);

    // Browsers tell us when each paragraph starts; the one being read is marked for sighted listeners.
    await page.evaluate(() => (window as any).__queue[1].onstart?.(new Event('start')));
    await expect(page.locator('[data-listen-current]')).toHaveCount(1);
    await player.getByRole('button', { name: 'Stop' }).click();
    await expect(page.locator('[data-listen-current]')).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('region', { name: 'Read aloud' }).getByLabel('Speed')).toHaveValue('1.25');
  });

  test('the "Listen to this post" button reads the post, marks where it is, and stops on a second press', async ({ page }) => {
    await fakeSpeech(page);
    await page.addInitScript(() => localStorage.setItem('a11y-welcomed', '1'));
    await page.goto('/posts/');
    const hrefs = await page.locator('main a[href^="/posts/"]').evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    const path = hrefs.find((href) => /^\/posts\/[^/]+\/$/.test(href));
    test.skip(!path, 'No post pages in this build (build with INCLUDE_DRAFTS=true).');
    await page.goto(path!);

    const button = page.locator('[data-listen]');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(1);
    const postText = (await page.locator('[data-listen-source]').innerText()).replace(/\s+/g, ' ');
    expect(postText).toContain((await spoken(page))[0]!.slice(0, 20)); // it reads the post body, not the menu
    expect((await spoken(page)).join(' ')).not.toContain('Skip to content');
    await expect(page.getByRole('region', { name: 'Read aloud' })).toBeVisible(); // the player appears so it can be paused

    await page.evaluate(() => (window as any).__queue[0].onstart?.(new Event('start')));
    await expect(page.locator('[data-listen-current]')).toHaveCount(1);

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-listen-current]')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Read aloud' })).toBeHidden(); // hidden again: it was not asked for
  });

  test('after "Use my choices" with reading ticked, keyboard focus is on Pause, so it can be paused at once', async ({ page }) => {
    await fakeSpeech(page);
    await page.goto('/');
    const dialog = welcomeWindow(page);
    await dialog.getByRole('checkbox', { name: 'Read the pages aloud to me' }).check();
    await dialog.getByRole('button', { name: 'Use my choices' }).click();
    const player = page.getByRole('region', { name: 'Read aloud' });
    await expect(player.getByRole('button', { name: 'Pause' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(player.getByRole('button', { name: 'Resume' })).toBeVisible();
  });

  test('while the player shows, the fourth Tab stop jumps to its controls; otherwise there is no such stop', async ({ page }) => {
    await fakeSpeech(page);
    await page.addInitScript(() => {
      localStorage.setItem('a11y-welcomed', '1');
      if (!localStorage.getItem('a11y-prefs')) localStorage.setItem('a11y-prefs', JSON.stringify({ aloud: 'on' }));
    });
    await page.goto('/');
    const focused = () => page.evaluate(() => (document.activeElement as HTMLElement).textContent?.trim());
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    expect(await focused()).toBe('Accessibility statement');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('Go to reading controls');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Read aloud' }).getByRole('button', { name: 'Listen to this page' })).toBeFocused();

    // Switched off: the stop is gone, so the first Tab stops are the same three as always.
    await page.evaluate(() => localStorage.setItem('a11y-prefs', JSON.stringify({ aloud: 'off' })));
    await page.reload();
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    expect(await focused()).not.toBe('Go to reading controls');
    await expect(page.getByRole('button', { name: 'Go to reading controls' })).toHaveCount(0);
  });

  test('the player is hidden until the visitor asks for it', async ({ page }) => {
    await fakeSpeech(page);
    await page.addInitScript(() => localStorage.setItem('a11y-welcomed', '1'));
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Read aloud' })).toBeHidden();
  });

  test('Display settings can turn the Listen button on and off for every page', async ({ page }) => {
    await fakeSpeech(page);
    await page.addInitScript(() => localStorage.setItem('a11y-welcomed', '1'));
    await page.goto('/');
    await page.locator('header [data-display-settings-open]').click();
    const settings = page.locator('#display-settings');
    await settings.getByRole('group', { name: 'Reading aloud' }).getByLabel('Show a Listen button on every page').check();
    await settings.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('region', { name: 'Read aloud' })).toBeVisible();
    await page.goto('/labs/');
    await expect(page.getByRole('region', { name: 'Read aloud' })).toBeVisible();
  });
});

test.describe('bigger buttons and links', () => {
  test('give buttons and menu links a target of at least 48 px', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('a11y-welcomed', '1');
      localStorage.setItem('a11y-prefs', JSON.stringify({ targets: 'large' }));
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-targets', 'large');
    const heights = await page.evaluate(() => {
      const h = (selector: string) => Math.round(document.querySelector(selector)!.getBoundingClientRect().height);
      return { button: h('main .btn'), footerLink: h('footer nav a'), menuLink: h('header nav a') };
    });
    expect(heights.button).toBeGreaterThanOrEqual(48);
    expect(heights.footerLink).toBeGreaterThanOrEqual(48);
    expect(heights.menuLink).toBeGreaterThanOrEqual(48);
  });

  test('can be switched on from Display settings and are remembered', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('a11y-welcomed', '1'));
    await page.goto('/');
    await page.locator('header [data-display-settings-open]').click();
    await page.locator('#display-settings').getByRole('group', { name: 'Buttons and links' }).getByLabel('Bigger').check();
    await expect(page.locator('html')).toHaveAttribute('data-targets', 'large');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-targets', 'large');
  });
});
