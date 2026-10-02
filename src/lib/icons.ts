import materialSymbols from '@iconify-json/material-symbols/icons.json';

const known = materialSymbols as { icons: Record<string, unknown>; aliases?: Record<string, unknown> };

/**
 * Icon names come from the database, so a typo must never break the build.
 * Accepts "material-symbols:name" (or just "name"); falls back if unknown.
 */
export function safeIcon(name: string | null | undefined, fallback = 'material-symbols:science-outline') {
  if (!name) return fallback;
  const bare = name.replace(/^material-symbols:/, '');
  return known.icons[bare] || known.aliases?.[bare] ? `material-symbols:${bare}` : fallback;
}
