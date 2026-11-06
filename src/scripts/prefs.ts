// Display settings: the choices a visitor makes in the "Display settings" panel and with the theme button.
// They live only in this browser's localStorage (key `a11y-prefs`) and are never sent, logged or measured.
// The inline script in BaseLayout.astro applies the same logic before first paint; keep the two in step.

export const OPTIONS = {
  theme: ['system', 'light', 'dark', 'high-contrast'],
  text: ['100', '125', '150', '175', '200'],
  spacing: ['normal', 'wide'],
  measure: ['standard', 'narrow'],
  motion: ['system', 'reduce'],
} as const;

export type PrefKey = keyof typeof OPTIONS;
export type Prefs = Partial<Record<PrefKey, string>>;

const KEY = 'a11y-prefs';
const LEGACY_THEME_KEY = 'theme'; // the old light/dark toggle stored its choice here

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
  for (const key of ['text', 'spacing', 'measure', 'motion'] as const) {
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

export function resetPrefs() {
  save({});
  update({});
}

// "Match my device" follows the device live.
darkQuery.addEventListener('change', () => update(getPrefs()));
