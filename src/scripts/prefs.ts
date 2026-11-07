// Display settings: the choices a visitor makes in the welcome window, the "Display settings" panel and with the
// theme button. They live only in this browser's localStorage (key `a11y-prefs`) and are never sent, logged or measured.
// The inline script in BaseLayout.astro applies the same logic before first paint; keep the two in step.

export const OPTIONS = {
  theme: ['system', 'light', 'dark', 'high-contrast'],
  text: ['100', '125', '150', '175', '200'],
  spacing: ['normal', 'wide'],
  measure: ['standard', 'narrow'],
  motion: ['system', 'reduce'],
  targets: ['normal', 'large'], // bigger buttons and links
  aloud: ['off', 'on'], // show the "Listen to this page" player on every page (it never starts by itself)
  rate: ['1', '0.75', '1.25', '1.5'], // speaking speed; not a CSS setting
} as const;

export type PrefKey = keyof typeof OPTIONS;
export type Prefs = Partial<Record<PrefKey, string>>;

const KEY = 'a11y-prefs';
const LEGACY_THEME_KEY = 'theme'; // the old light/dark toggle stored its choice here
const WELCOMED_KEY = 'a11y-welcomed'; // "1" once the visitor has answered the welcome window; it is not a setting

export function isPrefKey(name: string): name is PrefKey {
  return name in OPTIONS;
}

function isAllowed(key: PrefKey, value: unknown): value is string {
  return typeof value === 'string' && (OPTIONS[key] as readonly string[]).includes(value);
}

export function getPrefs(): Prefs {
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (parsed && typeof parsed === 'object') saved = parsed as Record<string, unknown>;
  } catch { /* unreadable or storage blocked: use the defaults */ }

  const prefs: Prefs = {};
  for (const key of Object.keys(OPTIONS) as PrefKey[]) {
    const value = saved[key];
    if (isAllowed(key, value)) prefs[key] = value;
  }
  if (!prefs.theme) {
    try {
      const legacy = localStorage.getItem(LEGACY_THEME_KEY);
      if (legacy === 'light' || legacy === 'dark') prefs.theme = legacy;
    } catch { /* ignore */ }
  }
  return prefs;
}

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

/** The theme actually showing, after "Match my device" and "High contrast" are resolved. */
export function currentTheme(prefs: Prefs = getPrefs()): 'light' | 'dark' {
  const theme = prefs.theme ?? 'system';
  if (theme === 'dark' || theme === 'high-contrast') return 'dark';
  if (theme === 'light') return 'light';
  return darkQuery.matches ? 'dark' : 'light';
}

function apply(prefs: Prefs) {
  const root = document.documentElement;
  root.dataset.theme = currentTheme(prefs);
  if (prefs.theme === 'high-contrast') root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
  // The first option of each group is the default, which is "no attribute".
  for (const key of ['text', 'spacing', 'measure', 'motion', 'targets', 'aloud'] as const) {
    const value = prefs[key];
    if (value && value !== OPTIONS[key][0]) root.dataset[key] = value;
    else delete root.dataset[key];
  }
}

function save(prefs: Prefs) {
  try {
    if (Object.keys(prefs).length) localStorage.setItem(KEY, JSON.stringify(prefs));
    else localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_THEME_KEY);
  } catch { /* storage blocked: the choice still applies until the page is closed */ }
}

const listeners = new Set<() => void>();

/** Run `callback` whenever the settings change (from the panel, the theme button or the device). */
export function onChange(callback: () => void) {
  listeners.add(callback);
}

function update(prefs: Prefs) {
  apply(prefs);
  listeners.forEach((callback) => callback());
}

export function setPref(key: PrefKey, value: string) {
  if (!isAllowed(key, value)) return;
  const prefs = { ...getPrefs(), [key]: value };
  save(prefs);
  update(prefs);
}

/** Drops anything that is not on the allow-list, whatever the caller passed in. */
function clean(prefs: Prefs): Prefs {
  const result: Prefs = {};
  for (const key of Object.keys(OPTIONS) as PrefKey[]) {
    const value = prefs[key];
    if (isAllowed(key, value)) result[key] = value;
  }
  return result;
}

/** Shows `prefs` on the page without saving them (the welcome window uses this while the visitor is still choosing). */
export function previewPrefs(prefs: Prefs) {
  update(clean(prefs));
}

/** Replaces every saved setting with `prefs`. */
export function replacePrefs(prefs: Prefs) {
  const next = clean(prefs);
  save(next);
  update(next);
}

export function resetPrefs() {
  save({});
  update({});
}

/**
 * Whether the visitor has already answered the welcome window. If the browser blocks storage we cannot remember an
 * answer, so we say "yes": asking again on every page would be worse than not asking.
 */
export function hasWelcomed(): boolean {
  try {
    return localStorage.getItem(WELCOMED_KEY) === '1';
  } catch {
    return true;
  }
}

export function markWelcomed() {
  try { localStorage.setItem(WELCOMED_KEY, '1'); } catch { /* storage blocked: nothing to remember */ }
}

// "Match my device" follows the device live.
darkQuery.addEventListener('change', () => update(getPrefs()));
