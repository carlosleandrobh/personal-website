/**
 * Markdown -> safe HTML for post bodies (build time only).
 * Pipeline: parse (GFM) -> HAST -> SANITISE -> demote h1 -> slug ids -> collect TOC
 *           -> external links hardening -> scrollable tables -> syntax highlight -> HTML string.
 * Sanitising before highlighting means no raw HTML from the database can
 * reach the page, even if a post body were tampered with.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import { SITE } from './site';

export interface Heading { depth: 2 | 3; id: string; text: string }
export interface RenderedMarkdown { html: string; headings: Heading[]; readingMinutes: number }

type Node = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Node[] };

function textOf(node: Node): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

function walk(node: Node, fn: (n: Node) => void) {
  fn(node);
  for (const child of node.children ?? []) walk(child, fn);
}

function collectHeadings(target: Heading[]) {
  return () => (tree: Node) => {
    walk(tree, (n) => {
      if (n.type === 'element' && (n.tagName === 'h2' || n.tagName === 'h3') && n.properties?.id) {
        target.push({ depth: n.tagName === 'h2' ? 2 : 3, id: String(n.properties.id), text: textOf(n) });
      }
    });
  };
}

const SITE_ORIGIN = new URL(SITE.url).origin;

/** True for http(s) links that leave this site. Compares parsed origins, not string prefixes
 *  (so `https://carlos.nz.example.com` and `https://carlos.nz@example.com` count as external). */
function isExternalLink(href: string) {
  try {
    const url = new URL(href, SITE.url);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin !== SITE_ORIGIN;
  } catch {
    return /^(https?:)?\/\//i.test(href); // malformed absolute URL: harden it, harmlessly
  }
}

function hardenLinks() {
  return (tree: Node) => {
    walk(tree, (n) => {
      if (n.type !== 'element' || n.tagName !== 'a') return;
      const href = String(n.properties?.href ?? '');
      if (isExternalLink(href)) {
        n.properties = { ...n.properties, target: '_blank', rel: ['noopener', 'noreferrer'] };
        // Tell screen reader users the link leaves this tab (WCAG 3.2.5 advisory technique G201).
        n.children = [
          ...(n.children ?? []),
          { type: 'element', tagName: 'span', properties: { className: ['sr-only'] }, children: [{ type: 'text', value: ' (opens in a new tab)' }] },
        ];
      }
    });
  };
}

/** The post title is the page's only h1, so an h1 in the body becomes an h2 (WCAG 1.3.1, 2.4.6). */
function demoteH1() {
  return (tree: Node) => {
    walk(tree, (n) => {
      if (n.type === 'element' && n.tagName === 'h1') n.tagName = 'h2';
    });
  };
}

/** Wide tables scroll inside their own container. Keeping <table> as a real table preserves its semantics;
 *  src/scripts/ui.ts makes the container keyboard-focusable only while it actually overflows. */
function wrapTables() {
  return (tree: Node) => {
    const visit = (parent: Node) => {
      parent.children = (parent.children ?? []).map((child) => {
        visit(child);
        if (child.type === 'element' && child.tagName === 'table') {
          return { type: 'element', tagName: 'div', properties: { className: ['table-scroll'] }, children: [child] };
        }
        return child;
      });
    };
    visit(tree);
  };
}

const schema = {
  ...defaultSchema,
  // Keep heading ids generated later by rehype-slug clean (no "user-content-" prefix needed
  // because slugs are added after sanitising).
  clobberPrefix: '',
};

export async function renderMarkdown(markdown: string): Promise<RenderedMarkdown> {
  const headings: Heading[] = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(demoteH1)
    .use(rehypeSlug)
    .use(collectHeadings(headings))
    .use(hardenLinks)
    .use(wrapTables)
    .use(rehypeShiki, { theme: 'github-dark-default' })
    .use(rehypeStringify)
    .process(markdown ?? '');

  return { html: String(file), headings, readingMinutes: readingMinutes(markdown) };
}

/** One definition everywhere (cards, post page, OG image): prose words / 220 wpm, code blocks excluded. */
export function readingMinutes(markdown: string) {
  const words = (markdown ?? '').replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}
