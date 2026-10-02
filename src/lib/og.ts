/**
 * Open Graph images (1200x627), rendered at build time with satori + resvg.
 * Follows the Stitch "open_graph_social_share_template": deep blue -> teal
 * gradient, amber edge, category pill, big title, author row.
 * These PNGs are also uploaded to LinkedIn as the article thumbnail.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { inflateSync } from 'node:zlib';

const root = process.cwd();

/**
 * WOFF 1.0 -> TTF/OTF (sfnt) using Node's own zlib. Satori would otherwise
 * inflate WOFF with its bundled fflate; converting here keeps that code path
 * out of the build entirely.
 */
function woffToSfnt(woff: Buffer): Buffer {
  if (woff.readUInt32BE(0) !== 0x774f4646) return woff; // not WOFF: already sfnt
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables: { tag: number; checksum: number; data: Buffer }[] = [];
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    const tag = woff.readUInt32BE(o);
    const offset = woff.readUInt32BE(o + 4);
    const compLength = woff.readUInt32BE(o + 8);
    const origLength = woff.readUInt32BE(o + 12);
    const checksum = woff.readUInt32BE(o + 16);
    const raw = woff.subarray(offset, offset + compLength);
    tables.push({ tag, checksum, data: compLength < origLength ? inflateSync(raw) : Buffer.from(raw) });
  }
  let searchRange = 1, entrySelector = 0;
  while (searchRange * 2 <= numTables) { searchRange *= 2; entrySelector++; }
  searchRange *= 16;
  const header = Buffer.alloc(12 + numTables * 16);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(numTables * 16 - searchRange, 10);
  const chunks: Buffer[] = [header];
  let offset = header.length;
  tables.forEach((t, i) => {
    const o = 12 + i * 16;
    header.writeUInt32BE(t.tag, o);
    header.writeUInt32BE(t.checksum, o + 4);
    header.writeUInt32BE(offset, o + 8);
    header.writeUInt32BE(t.data.length, o + 12);
    const padded = Buffer.alloc((t.data.length + 3) & ~3);
    t.data.copy(padded);
    chunks.push(padded);
    offset += padded.length;
  });
  return Buffer.concat(chunks);
}

const font = async (pkg: string, file: string) =>
  woffToSfnt(await readFile(path.join(root, 'node_modules', '@fontsource', pkg, 'files', file)));

let fontsPromise: Promise<Parameters<typeof satori>[1]['fonts']> | undefined;
function fonts() {
  fontsPromise ??= Promise.all([
    font('plus-jakarta-sans', 'plus-jakarta-sans-latin-800-normal.woff'),
    font('plus-jakarta-sans', 'plus-jakarta-sans-latin-700-normal.woff'),
    font('inter', 'inter-latin-400-normal.woff'),
    font('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'),
  ]).then(([jakarta800, jakarta700, inter400, mono500]) => [
    { name: 'Jakarta', data: jakarta800, weight: 800 as const, style: 'normal' as const },
    { name: 'Jakarta', data: jakarta700, weight: 700 as const, style: 'normal' as const },
    { name: 'Inter', data: inter400, weight: 400 as const, style: 'normal' as const },
    { name: 'Mono', data: mono500, weight: 500 as const, style: 'normal' as const },
  ]);
  return fontsPromise;
}

let avatarPromise: Promise<string | null> | undefined;
function avatar() {
  avatarPromise ??= (async () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      const file = path.join(root, 'src', 'assets', `portrait.${ext}`);
      if (existsSync(file)) {
        const buf = await sharp(file).resize(176, 176, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toBuffer();
        return `data:image/jpeg;base64,${buf.toString('base64')}`;
      }
    }
    return null;
  })();
  return avatarPromise;
}

type El = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): El =>
  ({ type, props: { style, children, ...extra } });

export type OgInput = {
  title: string;
  subtitle: string;
  kicker: string;     // e.g. category
  meta: string;       // e.g. "6 min read · Auckland, NZ"
  author: string;
  role: string;
  initials: string;
};

export async function renderOg(input: OgInput): Promise<Buffer> {
  const img = await avatar();
  const titleSize = input.title.length > 80 ? 44 : input.title.length > 52 ? 50 : 58;
  const subtitle = input.subtitle.length > 140
    ? `${input.subtitle.slice(0, 138).replace(/\s+\S*$/, '').replace(/[\s,;:—–-]+$/, '')}…`
    : input.subtitle;

  const tree = h('div', {
    width: 1200, height: 627, display: 'flex', position: 'relative', fontFamily: 'Inter', color: '#fff',
    backgroundImage: 'linear-gradient(135deg, #0E1E45 0%, #14346E 55%, #0B4B48 100%)',
  }, [
    // Teal glow + architectural rings (top-right)
    h('div', { position: 'absolute', right: -180, top: -260, width: 640, height: 640, borderRadius: 9999,
      backgroundImage: 'radial-gradient(circle, rgba(20,184,166,0.22) 0%, rgba(15,118,110,0) 70%)' }),
    h('div', { position: 'absolute', right: -80, top: -160, width: 400, height: 400, borderRadius: 9999, border: '1.5px dashed rgba(45,212,191,0.35)' }),
    h('div', { position: 'absolute', right: -150, top: -230, width: 540, height: 540, borderRadius: 9999, border: '1px solid rgba(56,189,248,0.18)' }),
    // Amber edge
    h('div', { position: 'absolute', left: 0, top: 0, width: 10, height: 627, backgroundColor: '#F59E0B' }),

    h('div', { display: 'flex', flexDirection: 'column', width: '100%', padding: '64px 96px 56px' }, [
      // Header row
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', alignItems: 'center', gap: 18 }, [
          h('div', { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 9999,
            backgroundColor: 'rgba(20,184,166,0.22)', border: '1.2px solid rgba(45,212,191,0.6)',
            fontFamily: 'Mono', fontSize: 16, letterSpacing: 1.5, color: '#99F6E4' }, [
            h('div', { width: 9, height: 9, borderRadius: 9999, backgroundColor: '#2DD4BF' }),
            input.kicker.toUpperCase(),
          ]),
          h('div', { fontFamily: 'Mono', fontSize: 16, color: '#94A3B8' }, input.meta),
        ]),
        h('div', { display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Jakarta', fontWeight: 800, fontSize: 30, color: '#F8FAFC' }, [
          'carlos.nz',
          h('div', { width: 10, height: 10, borderRadius: 9999, backgroundColor: '#F59E0B' }),
        ]),
      ]),
      h('div', { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 34 }),

      // Title + subtitle
      h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, [
        h('div', { fontFamily: 'Jakarta', fontWeight: 800, fontSize: titleSize, lineHeight: 1.12, letterSpacing: -1.2, maxWidth: 960 }, input.title),
        h('div', { fontSize: 24, lineHeight: 1.4, color: '#CBD5E1', marginTop: 20, maxWidth: 900 }, subtitle),
      ]),

      // Accent rule
      h('div', { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 30 }, [
        h('div', { width: 160, height: 4, borderRadius: 2, backgroundColor: '#F59E0B' }),
        h('div', { flexGrow: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.1)' }),
      ]),

      // Author row
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', alignItems: 'center', gap: 22 }, [
          h('div', { display: 'flex', width: 88, height: 88, borderRadius: 9999, border: '2px solid #2DD4BF', padding: 4 }, [
            img
              ? h('img', { width: 76, height: 76, borderRadius: 9999, objectFit: 'cover' }, undefined, { src: img, width: 76, height: 76 })
              : h('div', { width: 76, height: 76, borderRadius: 9999, backgroundColor: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Jakarta', fontWeight: 800, fontSize: 30 }, input.initials),
          ]),
          h('div', { display: 'flex', flexDirection: 'column' }, [
            h('div', { fontFamily: 'Jakarta', fontWeight: 700, fontSize: 26, color: '#F8FAFC' }, input.author),
            h('div', { fontSize: 18, color: '#94A3B8', marginTop: 4 }, input.role),
          ]),
        ]),
        h('div', { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderRadius: 10,
          backgroundColor: '#1E293B', border: '1px solid #334155', fontFamily: 'Mono', fontSize: 17, color: '#F1F5F9' }, [
          h('div', { width: 9, height: 9, borderRadius: 9999, backgroundColor: '#22C55E' }),
          'carlos.nz/posts',
        ]),
      ]),
    ]),
  ]);

  const svg = await satori(tree as any, { width: 1200, height: 627, fonts: await fonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
