const nz = 'en-NZ';

export const monthYear = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat(nz, { month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' }).format(new Date(iso)) : '';

export const fullDate = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat(nz, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' }).format(new Date(iso)) : '';

export function dateRange(start: string | null, end: string | null, ongoingLabel = 'Present') {
  return `${monthYear(start)} – ${end ? monthYear(end) : ongoingLabel}`;
}

export function duration(start: string, end: string | null) {
  const a = new Date(start);
  const b = end ? new Date(end) : new Date();
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years > 1 ? 's' : ''}`);
  if (rest) parts.push(`${rest} mo`);
  return parts.join(' ') || '1 mo';
}

export const postUrl = (slug: string) => `/posts/${slug}/`;
export const absolute = (path: string) => new URL(path, 'https://carlos.nz').toString();
