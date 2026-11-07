// "Words on this page" (WordsOnPage.astro): finds which glossary terms the page's own text uses and lists them with their
// meanings. It reads text only, builds the list with textContent (never innerHTML), and sends nothing anywhere.
import { GLOSSARY, type GlossaryTerm } from '../lib/glossary';

const section = document.querySelector<HTMLElement>('[data-words]');
const main = document.querySelector('main');
const list = section?.querySelector<HTMLElement>('[data-words-list]');
const template = section?.querySelector<HTMLTemplateElement>('template[data-words-item]');

/** The page's own words, one text node at a time, leaving out this list, code and text that is only for screen readers. */
function pageText(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest('[data-words], pre, script, style, .sr-only, [aria-hidden="true"]')) parts.push(node.textContent ?? '');
  }
  return parts.join(' ');
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isWordChar = (char: string | undefined) => char !== undefined && /[A-Za-z0-9-]/.test(char);

/**
 * Whole-word match. An abbreviation (no lowercase letters) must match its case, so "AI" is not found in "said"; other
 * terms ignore case. A trailing "s" or "es" is allowed ("ERPs"). A word inside another ("SQL" in "T-SQL") is not a match.
 */
function uses(text: string, entry: GlossaryTerm): boolean {
  const abbreviation = !/[a-z]/.test(entry.term);
  const pattern = new RegExp(escape(entry.term), abbreviation ? 'g' : 'gi');
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const before = text[match.index - 1];
    const after = text.slice(match.index + match[0].length).replace(/^(?:es|s)(?![A-Za-z0-9-])/, '');
    if (!isWordChar(before) && !isWordChar(after[0])) return true;
  }
  return false;
}

if (section && main && list && template) {
  const text = pageText(main);
  const found = GLOSSARY.filter((entry) => uses(text, entry)).sort((a, b) => a.term.localeCompare(b.term, 'en-NZ'));
  for (const entry of found) {
    const item = template.content.cloneNode(true) as DocumentFragment;
    item.querySelector('[data-word]')!.textContent = entry.term;
    if (entry.expansion) item.querySelector('[data-expansion]')!.textContent = ` — ${entry.expansion}`;
    item.querySelector('dd')!.textContent = entry.meaning;
    list.append(item);
  }
  section.hidden = found.length === 0;
}
