// Checks the colour tokens in src/styles/global.css against WCAG 2.2.
// Text pairs need 4.5:1 (1.4.3); component boundaries and focus rings need 3:1 (1.4.11).
// axe covers rendered text, but not field borders or focus rings, which is why this exists.
//
// Usage: node scripts/check-contrast.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS = fileURLToPath(new URL('../src/styles/global.css', import.meta.url));

const TEXT_MIN = 4.5;
const UI_MIN = 3;

// [foreground token, background token, minimum ratio, why]
const PAIRS = [
  ['fg', 'bg', TEXT_MIN, 'body text'],
  ['fg', 'surface', TEXT_MIN, 'text on cards'],
  ['fg', 'surface-2', TEXT_MIN, 'text on tinted panels'],
  ['muted', 'bg', TEXT_MIN, 'secondary text'],
  ['muted', 'surface', TEXT_MIN, 'secondary text on cards'],
  ['muted', 'surface-2', TEXT_MIN, 'secondary text on tinted panels'],
  ['subtle', 'bg', TEXT_MIN, 'small print'],
  ['subtle', 'surface', TEXT_MIN, 'small print on cards'],
  ['subtle', 'surface-2', TEXT_MIN, 'small print on tinted panels'],
  ['brand', 'bg', TEXT_MIN, 'headings'],
  ['brand', 'surface', TEXT_MIN, 'headings on cards'],
  ['accent', 'bg', TEXT_MIN, 'teal text and icons'],
  ['accent', 'surface', TEXT_MIN, 'teal text on cards'],
  ['accent', 'accent-tint', TEXT_MIN, 'chips'],
  ['on-cta', 'cta', TEXT_MIN, 'primary button label'],
  ['input-line', 'surface', UI_MIN, 'form field border (1.4.11)'],
  ['input-line', 'bg', UI_MIN, 'form field border on the page (1.4.11)'],
  ['accent', 'bg', UI_MIN, 'focus ring on the page (2.4.11)'],
  ['accent', 'surface', UI_MIN, 'focus ring on cards (2.4.11)'],
];

const css = readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function block(selector) {
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Block not found in global.css: ${selector}`);
  return Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

const light = block(':root');
const dark = { ...light, ...block("\\[data-theme='dark'\\]") };
// High contrast is the dark theme with extreme colours on top (data-theme="dark" data-contrast="high").
const high = { ...dark, ...block("\\[data-contrast='high'\\]") };

function parse(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const fn = value.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)$/i);
  if (fn) return { r: +fn[1], g: +fn[2], b: +fn[3], a: fn[4] === undefined ? 1 : +fn[4] };
  throw new Error(`Unsupported colour value: ${value}`);
}

function over(top, bottom) {
  const mix = (t, b) => Math.round(t * top.a + b * (1 - top.a));
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function luminance({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function ratio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

let failures = 0;
for (const [theme, tokens] of [['light', light], ['dark', dark], ['high contrast', high]]) {
  for (const [fgName, bgName, minimum, why] of PAIRS) {
    const bgValue = tokens[bgName];
    const fgValue = tokens[fgName];
    if (!bgValue || !fgValue) throw new Error(`Missing token in ${theme} theme: ${fgValue ? bgName : fgName}`);
    // Translucent backgrounds (the dark accent tint) are composited over the card surface they sit on.
    const bg = over(parse(bgValue), parse(tokens.surface));
    const fg = over(parse(fgValue), bg);
    const value = ratio(fg, bg);
    if (value < minimum) {
      failures += 1;
      console.error(`${theme}: ${fgName} on ${bgName} = ${value.toFixed(2)}:1, needs ${minimum}:1 (${why})`);
    }
  }
}

console.log(`contrast: ${failures} problem(s)`);
process.exit(failures ? 1 : 0);
