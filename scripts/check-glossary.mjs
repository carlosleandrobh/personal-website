// Keeps the glossary (src/lib/glossary.ts) in step with the text of the built site, in both directions:
//   missing: an abbreviation a page uses that has no entry (and is not a plain name in NOT_JARGON);
//   unused:  an entry that no page uses any more.
// It reads the HTML in dist/, so build first. The real site is the judge: build with the real content (a .env with the
// Supabase secrets) to check both directions. With CONTENT_SOURCE=fixtures (CI) only "missing" is checked, because the
// test content is not the site's text and must not keep a term alive or have one removed.
//
// Usage: node --experimental-strip-types scripts/check-glossary.mjs [--warn]
//   --warn   report the problems as GitHub warnings and exit 0 (the deploy uses this, so a post is never held back).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABBREVIATION, FIXTURE_ONLY, GLOSSARY, NOT_JARGON, knownWords, usesTerm } from '../src/lib/glossary.ts';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const warnOnly = process.argv.includes('--warn');
const fixtures = process.env.CONTENT_SOURCE === 'fixtures';

// Pages that do not count as "the site's text": the glossary itself, and pages visitors do not read.
const SKIP = [/^glossary\//, /^linkedin\//, /^404\.html$/];

if (!existsSync(DIST)) {
  console.error('glossary: dist/ not found. Run `npm run build` first.');
  process.exit(2);
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : entry.name.endsWith('.html') ? [path] : [];
  });
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * The words a visitor reads in <main>, the same text "Words on this page" looks at (src/scripts/words.ts): not that
 * list itself, not code blocks, not text that is only for screen readers.
 */
function pageText(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/)?.[1] ?? '';
  return main
    .replace(/<section\b[^>]*\bdata-words\b[\s\S]*$/, ' ') // the list is the last thing in <main>
    .replace(/<(script|style|pre|template|svg)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<(\w+)\b[^>]*\bclass="[^"]*\bsr-only\b[^"]*"[^>]*>[^<]*<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&(\w+);/g, (whole, name) => ENTITIES[name] ?? whole)
    .replace(/\s+/g, ' ');
}

const known = knownWords();
const plainNames = new Set([...NOT_JARGON, ...(fixtures ? FIXTURE_ONLY : [])]);
const missing = new Map(); // abbreviation -> pages
const usedBy = new Map(GLOSSARY.map((entry) => [entry.term, []]));
let pages = 0;

for (const file of htmlFiles(DIST)) {
  const page = relative(DIST, file).replaceAll('\\', '/');
  if (SKIP.some((pattern) => pattern.test(page))) continue;
  pages += 1;
  const text = pageText(readFileSync(file, 'utf8'));
  const url = `/${page.replace(/index\.html$/, '')}`;
  for (const token of new Set(text.match(ABBREVIATION) ?? [])) {
    if (!known.has(token) && !plainNames.has(token)) missing.set(token, [...(missing.get(token) ?? []), url]);
  }
  for (const entry of GLOSSARY) if (usesTerm(text, entry.term)) usedBy.get(entry.term).push(url);
}

const unused = fixtures ? [] : [...usedBy].filter(([, urls]) => urls.length === 0).map(([term]) => term);
const problems = [
  ...[...missing].sort().map(([token, urls]) => `"${token}" is used on ${urls.join(', ')} but is not in the glossary. Add it to GLOSSARY in src/lib/glossary.ts, or to NOT_JARGON there if it is a name.`),
  ...unused.sort().map((term) => `"${term}" is in the glossary but no page uses it. Remove it from GLOSSARY in src/lib/glossary.ts.`),
];

for (const problem of problems) console.log(warnOnly ? `::warning title=Glossary out of step::${problem}` : `  ✗ ${problem}`);
console.log(`glossary: ${pages} page(s), ${GLOSSARY.length} term(s), ${missing.size} missing, ${fixtures ? 'unused not checked (fixtures)' : `${unused.length} unused`}`);
process.exit(problems.length && !warnOnly ? 1 : 0);
