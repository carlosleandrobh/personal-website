const nz = 'en-NZ';

export const monthYear = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat(nz, { month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' }).format(new Date(iso)) : '';

export const fullDate = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat(nz, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' }).format(new Date(iso)) : '';

export function dateRange(start: string | null, end: string | null, ongoingLabel = 'Present') {
  return `${monthYear(start)} – ${end ? monthYear(end) : ongoingLabel}`;
}

/**
 * How long a role lasted, in whole words ("8 years 9 months"), because screen readers read "yrs" and "mo" badly.
 * Dates are read in UTC: they are stored as plain dates (2026-07-01 = midnight UTC), so a build on a computer west of
 * UTC would otherwise see 30 June and count one month too many.
 */
export function duration(start: string, end: string | null) {
  const a = new Date(start);
  const b = end ? new Date(end) : new Date();
  const months = Math.max(1, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [years && unit(years, 'year'), rest && unit(rest, 'month')].filter(Boolean).join(' ');
}

export const postUrl = (slug: string) => `/posts/${slug}/`;
export const absolute = (path: string) => new URL(path, 'https://carlos.nz').toString();
