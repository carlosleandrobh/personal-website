# Accessibility — carlos.nz

This document records how the site stays accessible and how that is checked. It is practical guidance, not legal
advice. The long reference guide, [accessibility-security-privacy-guide.md](accessibility-security-privacy-guide.md),
has the research and the wider rationale, but parts of it assume a different stack (Jinja2, a Cloudflare Worker,
`site.yml`). **Where the two disagree, this document and the code win.**

## Target

- **WCAG 2.2 level AA** on every page, in the light, dark and Windows high-contrast (forced colours) modes.
- The site is a personal portfolio, so the NZ Government Web Accessibility Standard does not apply. It is used as the
  local benchmark.
- The public statement lives at `/accessibility/` (`src/pages/accessibility.astro`). Keep it accurate: never write
  "fully accessible" or "WCAG compliant". Update its review date and test list whenever the site is re-tested.

## Checks

```bash
npm run build                 # the checks below test the built site in dist/
npm run test:contrast         # colour tokens in src/styles/global.css (text 4.5:1, borders and focus rings 3:1)
npm run test:a11y             # Playwright + axe-core, keyboard, reflow at 320 px, reduced motion, forced colours,
                              # the welcome window, reading aloud and bigger targets (e2e/welcome.spec.ts)
uv run pytest                 # includes the alt text rules for `cms post push`
```

Build with `CONTENT_SOURCE=fixtures INCLUDE_DRAFTS=true` to test post pages from the fixtures. The first time, run
`npx playwright install chromium`. CI runs the same checks in the `a11y` job, and it blocks merging.

`e2e/a11y.spec.ts` blocks every request to another origin, so the tests also prove that no third-party code loads
on page views. axe's colour-contrast rule is switched off in forced-colours mode only, because axe reads the
author's colours there, not the ones the browser applies.

Automated checks find only part of the barriers. For a change to layout or a component, also check by hand:

- Keyboard only: Tab, Shift+Tab, Enter, Space and Esc through the menu, the Labs filter and the contact form.
- Zoom to 200% and 400%.
- Dark theme and a Windows contrast theme.
- A screen reader (NVDA with Firefox, or VoiceOver) on anything new that is interactive.

## Rules for the code

1. **Native HTML first.** Use `a`, `button`, `label`, `fieldset`, `dialog`. No click handlers on `div`, no positive
   `tabindex`. Add ARIA only when HTML cannot say it.
2. **Colour lives in tokens** in `src/styles/global.css` (`:root` and `[data-theme='dark']`). Text must reach 4.5:1,
   and form field borders, focus rings and meaningful graphics 3:1. `npm run test:contrast` enforces it. Do not change
   the brand colours to make a check pass; change the token that is used for text or borders.
3. **Never colour alone.** An error also gets text and an icon; a selected filter is also `aria-pressed`, and has a
   system-colour style in `@media (forced-colors: active)`.
4. **Focus must be visible.** Do not write `outline: none` without a replacement. Use a transparent outline when the
   ring is drawn with `box-shadow`, so it survives forced colours. A card that is one big link (a stretched `::after`
   link, as in `PostCard` and `RepoCard`) takes `data-card-link` on the link: `global.css` then rings the whole card.
   Never put `focus-visible:outline-none` on such a link; that left post cards with no visible focus. The test "every
   Tab stop shows where the keyboard focus is" (`e2e/a11y.spec.ts`) fails if any stop on the key pages has no indicator.
5. **Motion respects the device.** Animations and transitions are off under `prefers-reduced-motion: reduce`
   (a global rule in `global.css`). The hero arch is the one orchestrated moment and only plays when motion is allowed.
   Anything that loops stops after a few seconds.
6. **New-tab links say so.** Every `target="_blank"` link has `<span class="sr-only"> (opens in a new tab)</span>`.
   Post links get it automatically from `src/lib/markdown.ts`.
7. **Forms:** every field has a `label`, an error line linked with `aria-describedby`, and the error summary takes
   focus on a failed send (see `src/scripts/contact-form.ts`). Never clear what someone typed after an error.
8. **Scrolling containers** (wide tables, code) are reachable by keyboard. Shiki adds `tabindex="0"` to code blocks;
   `src/scripts/ui.ts` does the same for tables, but only while they overflow.
9. **No overlays, no CAPTCHAs that need a puzzle, no accessibility widgets from third parties.** Anything new from a
   third party needs the CSP in `astro.config.mjs` and the privacy notice updated first (see `CLAUDE.md`).
10. **Display settings only change CSS.** `src/scripts/prefs.ts` sets `data-*` attributes on `<html>` (`data-theme`,
    `data-contrast`, `data-text`, `data-spacing`, `data-measure`, `data-motion`, `data-targets`, `data-aloud`) and saves
    them under the `localStorage` key `a11y-prefs`, from an allow-list of values (the speaking speed, `rate`, is saved
    there too but is not a CSS setting). A second key, `a11y-welcomed`, only records that the welcome window has been
    answered. They never change ARIA, content or the DOM order, and are never sent, logged or measured. High contrast is the dark theme plus `data-contrast="high"`. The inline script
    in `BaseLayout.astro` applies the same logic before first paint, so keep the two in step. The site must work
    fully without the panel (its button stays hidden until the script runs).
11. **Use `rem` for text and spacing so the text size setting works,** but keep the header's top bar in px
    (`Header.astro`), so it still fits a 320 px screen at 200% text. Headings may break a long word
    (`overflow-wrap: anywhere`), and every grid column that holds form fields or long content (a code block, a table)
    uses `minmax(0, 1fr)`, on a phone too: an `auto` column grows to the longest line of code and the whole post then
    scrolls sideways. A full-width button (`.btn.w-full`) may wrap its label; other buttons stay on one line.
    `e2e/a11y.spec.ts` checks every page, post pages included, at 320 px with 200% text and wide spacing, and with the
    WCAG 1.4.12 text spacing overrides.
12. **Never detect or infer assistive technology or disability.** Do not read `prefers-*` or `forced-colors` into
    logs, analytics or the database. The welcome window (rule 14) is how the site finds out what helps: it asks. It
    never decides for the visitor, and its options are named by what they do ("Larger text and stronger contrast"),
    never by a condition ("I am blind").
13. **The first Tab stops are fixed:** "Skip to content", "Display settings", "Accessibility statement" (in `BaseLayout.astro`).
    The home page also shows an always-visible "Made for everyone" note (`Hero.astro`). A fourth stop, "Go to reading
    controls", exists only while the read-aloud player shows (rule 15); when the player is hidden it is not in the page.
14. **The welcome window** (`WelcomeDialog.astro`, `src/scripts/welcome.ts`) is a native modal `<dialog>` that opens
    once, on a visitor's first visit. It is the only window that opens by itself, so keep it small and keep these rules:
    - Focus starts on its title, so a screen reader reads the title and then the choices in order. Its ids are unique
      (`welcome-window-*`): the home page already has a `welcome-title`, and a repeated id gave the dialog the wrong name.
    - Each tick previews its effect (`previewPrefs`); "Use my choices" saves it (`replacePrefs`); "Continue without
      changes", Esc and any other way of closing it put the page back as it was. Every route marks it answered.
    - It does not open on the accessibility statement, the Easy Read page or the LinkedIn callback page
      (`welcome={false}` on `BaseLayout`), and not at all when the browser blocks storage (it could not remember the
      answer, so it would open on every page).
    - An option that cannot work is not offered: with no `speechSynthesis`, "Read the pages aloud" is removed.
    - Do not add audio that plays by itself. Reading starts only from a button press (rule 15).
    - Every end-to-end test except `e2e/welcome.spec.ts` starts with `a11y-welcomed` already set, or the window would
      cover every page.
15. **Speech is opt-in.** `src/scripts/listen.ts` and `ListenPlayer.astro` read the page aloud with the browser's own
    voices, only when the visitor presses a button ("Use my choices" with reading ticked, the player's Listen button, or
    a post's "Listen to this post"). The player stays hidden until it is asked for (welcome window or Display settings)
    or a reading starts. It has Pause, Resume, Stop and Speed, outlines the paragraph being read (`data-listen-current`:
    a ring and not a fill, so text contrast is unchanged) and never uses the microphone. Pause remembers the paragraph
    and resumes from its start, because the browser's own pause is unreliable. The player is at the end of the page, so
    keyboard focus is taken to Pause when a reading starts from the welcome window, and the fourth Tab stop ("Go to
    reading controls") jumps to it at any time.
16. **The header scrolls away on short screens** (`max-height: 31.25rem`, in `global.css`; the header carries
    `data-site-header`). A laptop at 400% zoom shows about 320 x 200 CSS px, so a fixed 80 px header would cover 40% of it.
    Do not add other fixed or sticky bars that take real height without the same rule.
17. **The page order is the reading order.** The tab order and the screen reader order follow the HTML, so the HTML
    must follow what is on screen. On a post the text comes first and the sidebar (share, listen, contents) after it:
    below the text on a phone, beside it on the right on a wide screen. Do not use CSS `order` to put something first on
    screen that comes later in the HTML. `e2e/a11y.spec.ts` checks this on a phone and a desktop.

## Rules for content

- **Headings:** the post title is the only `h1`. Start post bodies at `##`; a `#` in the body is turned into `##`.
- **Images:** every image needs alt text that says what it shows and why it is there, in about a sentence. No file
  names, and not just "image" or "screenshot". `uv run cms post push --publish` refuses to publish a post with an
  empty or useless `alt`; a draft is saved with a warning. A cover image needs `cover_alt`; write `cover_alt: ""` only
  when the cover is purely decorative.
- **Diagrams and screenshots of terminals:** give a short alt, then put the full text equivalent in the post right
  under the image (**Text description:** …, or a table when the data is tabular). Publish commands and configuration
  as text, not as screenshots. Raw HTML is not allowed in posts, so `<details>` is not available.
- **Homelab detail:** describe the architecture, not the addressing. Use documentation addresses (`192.0.2.0/24`,
  `example.com`) and no real hostnames, ports or versions of exposed services, in the image and in its description.
- **Plain language:** open key pages and long posts with a sentence or two of summary (a post's `excerpt` is shown as
  its summary), and spell out an abbreviation the first time it appears ("Proxmox VE, a virtualisation platform").
- **Glossary:** add a new abbreviation or technical term to `src/lib/glossary.ts`. Keep each meaning to a sentence or two.
- **Easy Read:** `src/pages/about/easy-read.astro` restates the About section in short sentences. Re-read it whenever
  the profile changes, so the two never disagree.
- **Te reo Māori** in a `.astro` file is wrapped in `lang="mi"`, with macrons. The hero marks a greeting that starts
  with "Kia ora" automatically.
- **Links** make sense on their own ("View the repository on GitHub", not "click here").
- Write in New Zealand English. Te reo Māori uses macrons (Māori, Tāmaki Makaurau) and can be marked
  with `lang="mi"` in `.astro` files.

## Before opening a pull request that changes the interface

- [ ] `npm run check`, `npm run build`, `npm run test:contrast`, `npm run test:a11y` pass.
- [ ] Keyboard, 400% zoom and dark theme checked by hand for what changed.
- [ ] New colours, if any, are tokens and pass the contrast script.
- [ ] No new third-party origin (or the CSP and the privacy notice are updated).
- [ ] `/accessibility/` still describes reality (known issues, test list, review date).

## Not built, on purpose

Accessibility overlays and widgets, a custom voice interface, an AI chatbot, assistive-technology detection and
public comments. The reasons are in section 4.19 of the long guide.

Left out for now, because each needs a decision or a person rather than code:

- **AI-drafted image descriptions** (guide section 4.17). They need an API key, a new dependency and a decision on
  sending images to a third party. If added, a person must review every description before it is published.
- **A New Zealand Sign Language video.** It needs an accredited interpreter.
- **A reading ruler and an alternative "dyslexia" font** (both optional in the guide, with limited evidence).
