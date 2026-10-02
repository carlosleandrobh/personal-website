/**
 * Markdown -> safe HTML for post bodies (build time only).
 * Pipeline: parse (GFM) -> HAST -> SANITISE -> slug ids -> collect TOC
 *           -> external links hardening -> syntax highlight -> HTML string.
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

function hardenLinks() {
  return (tree: Node) => {
    walk(tree, (n) => {
      if (n.type !== 'element' || n.tagName !== 'a') return;
      const href = String(n.properties?.href ?? '');
      if (/^https?:\/\//.test(href) && !href.startsWith('https://carlos.nz')) {
        n.properties = { ...n.properties, target: '_blank', rel: ['noopener', 'noreferrer'] };
      }
    });
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
    .use(rehypeSlug)
    .use(collectHeadings(headings))
    .use(hardenLinks)
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
