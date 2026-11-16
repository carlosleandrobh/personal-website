// "Words on this page" (WordsOnPage.astro): finds which glossary terms the page's own text uses and lists them with their
// meanings. It reads text only, builds the list with textContent (never innerHTML), and sends nothing anywhere.
import { GLOSSARY, usesTerm } from '../lib/glossary';

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

if (section && main && list && template) {
  const text = pageText(main);
  const found = GLOSSARY.filter((entry) => usesTerm(text, entry.term)).sort((a, b) => a.term.localeCompare(b.term, 'en-NZ'));
  for (const entry of found) {
    const item = template.content.cloneNode(true) as DocumentFragment;
    item.querySelector('[data-word]')!.textContent = entry.term;
    if (entry.expansion) item.querySelector('[data-expansion]')!.textContent = ` — ${entry.expansion}`;
    item.querySelector('dd')!.textContent = entry.meaning;
    list.append(item);
  }
  section.hidden = found.length === 0;
}
