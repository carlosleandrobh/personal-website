import type { Page } from '@playwright/test';

/**
 * Visible elements that reach past the right edge of the screen. `<main>` clips sideways overflow (overflow-x: clip),
 * so content that is too wide does not make the page scroll: it is cut off instead, and a scrollWidth check misses it.
 * An element inside a box that clips or scrolls and itself fits on the screen (a decorative arch in a card, a wide
 * table in its scrolling box) is not counted.
 */
export async function cutOffAtTheRight(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const edge = document.documentElement.clientWidth + 1;
    const fitsInClip = (el: Element) => {
      for (let a = el.parentElement; a && a.tagName !== 'MAIN' && a !== document.body; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        // A box that clips or scrolls (a wide table or code block, rule 8) and itself fits on the screen is fine.
        if (['hidden', 'clip', 'auto', 'scroll'].includes(ox) && a.getBoundingClientRect().right <= edge) return true;
      }
      return false;
    };
    return [...document.querySelectorAll('main *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.right <= edge) return false;
        if (el.closest('.sr-only, [hidden], template')) return false;
        if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return false;
        return !fitsInClip(el);
      })
      .filter((el, _, all) => !all.some((other) => other !== el && el.contains(other))) // the innermost ones say most
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}" ends at ${Math.round(el.getBoundingClientRect().right)} px`);
  });
}

/**
 * Controls that stand on their own and are smaller than 44 x 44 CSS px on the page as it is now (rule 16 in
 * docs/ACCESSIBILITY.md). WCAG asks for 24 px; 44 px is the size that suits a tremor or a thumb.
 */
export async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const list: string[] = [];
    document.querySelectorAll<HTMLElement>('a[href], button, select, textarea, summary, input:not([type=hidden])').forEach((el) => {
      if (el.closest('[aria-hidden="true"], [hidden], dialog:not([open])')) return;
      if (el.matches('[data-card-link]')) return; // stretched over the whole card, so the card is the target
      let box = el.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) return; // revealed only on focus, or for screen readers
      const label = (el as HTMLInputElement).labels?.[0];
      if (label && el.matches('input[type=checkbox], input[type=radio]')) box = label.getBoundingClientRect(); // the label is the target too
      // A link inside a sentence is exempt: its height is set by the line, and the line is the context.
      const block = el.closest('p, li, dd, dt, td, label');
      const inSentence = el.matches('a') && getComputedStyle(el).display === 'inline' && block && (block.textContent ?? '').replace(el.textContent ?? '', '').trim().length > 3;
      if (inSentence) return;
      if (box.width < 44 || box.height < 44) list.push(`${Math.round(box.width)}x${Math.round(box.height)} ${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)}"`);
    });
    return [...new Set(list)];
  });
}
