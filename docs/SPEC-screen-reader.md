# Spec: a smoother screen reader experience

Status: **approved 16 Nov 2026** · Rules it builds on: [ACCESSIBILITY.md](ACCESSIBILITY.md)

## Objective

Make carlos.nz as easy to use with a screen reader (NVDA, JAWS, VoiceOver, TalkBack) as it is with eyes, and prove
it with a real screen reader instead of automated checks alone.

The visitors are recruiters, hiring managers and clients who are blind or have low vision. They move through a
page by headings (the H key), landmarks and the list of links, or by reading straight through. They want to find out
quickly who Carlos is, what he has done, whether he is available, and how to contact him.

### What it is like today (found on 16 Nov 2026)

How this was checked: the built site (`npm run build`, seed content) was opened in Chromium through Playwright. The
script recorded the accessibility tree that screen readers receive, the heading list, the landmarks and the Tab
order on `/`, `/labs/` and `/contact/`. There were no posts in the seed, so post pages were reviewed from the code
only. **No real screen reader was used.** The accessibility statement already says so.

The foundations are strong: `lang="en-NZ"`, one `h1` per page, a logical heading tree, landmarks (header, Main and
Footer navigation, main, footer), a skip link as the first Tab stop, alt text on the portrait, "(opens in a new tab)"
on every external link, native `<dialog>` windows, labelled form fields with an error summary that takes focus, filter
buttons with `aria-pressed` and a polite result count, the "Kia ora" greeting marked `lang="mi"`, and decorative icons
hidden. Nothing blocks a screen reader user from any task. What remains is friction:

| # | Where | What a screen reader user meets | Effect |
|---|---|---|---|
| F1 | Whole site | Never tested with a real screen reader | Unknown problems remain; the statement cannot claim more |
| F2 | Welcome window (first visit) | Focus starts on the title, then five tick boxes. "Using a screen reader…? You don't need to change anything" comes **after** them | The one sentence meant for them comes last. Ticking "Read the pages aloud" would add a second voice on top of the screen reader |
| F3 | Lab, post and repository cards | Status, category, date and owner come **before** the card's heading ("Live Self-hosted", then heading "BentoPDF") | Moving by heading (H key) lands after them, so "Live" and the date are missed |
| F4 | Repository cards | Heading text is "personal-website on GitHub (opens in a new tab)" | The heading list repeats "on GitHub (opens in a new tab)" three times |
| F5 | Experience | "5 mo", "8 yrs 9 mo" | Read as "5 moe" or spelt out letter by letter, depending on the voice |
| F6 | Now, Education, hero figure | Status words join the text before them: "DP-300 — Azure Database Administrator Studying", "In progress Since Apr 2026", "Self-hosted Always changing", "Business Technology" | Hard to tell where one item ends and the status begins |
| F7 | "Where I can help" | Each item reads "list item 1 of 5, 1, heading…" | The number is read twice |
| F8 | Labs page | Summary reads "Live, 3 live"; result count says "Showing 1 of 1 experiments" | Repetition; wrong plural |
| F9 | Lab cards | Links "Code" and "Read notes" | In a list of links (NVDA Insert+F7, VoiceOver rotor) they do not say which lab they belong to |
| F10 | Post page | "Copy link" changes its own label to "Link copied" | Most screen readers do not announce the change, so nothing seems to happen |
| F11 | Contact form | The "0 / 5000" counter is not linked to the message field | The limit is not announced |
| F12 | Hero | The availability ("Open to connections…") and the greeting come before the `h1` | Someone who jumps straight to the `h1` misses whether Carlos is available |
| F13 | Experience, Education | Portuguese names (Drogaria Araujo, PUC Minas) are read with English pronunciation | Names are hard to recognise when heard |
| F14 | Hero, 320 px screen at 200% text (found 16 Nov 2026) | The "See my work" button does not wrap, so the hero column grows to 412 px; `<main>` clips it and the heading is cut off ("busines…") | People with low vision on a small phone cannot read the main heading. The reflow test missed it because the clip stops sideways scrolling |
| F15 | Repository cards with real GitHub data (found 16 Nov 2026) | "PL/SQL" and "T-SQL" are not in the glossary | "Words on this page" cannot explain them, and `e2e/words.spec.ts` fails when built from Supabase |

## Requirements and acceptance criteria

**SR-1 Test with real screen readers (F1).** Carlos runs the tasks in [USER-TESTING.md](USER-TESTING.md) himself with
NVDA and Firefox on Windows and VoiceOver and Safari on iPhone, on `/`, `/labs/`, a post, `/contact/` and the welcome
window, after SR-2 to SR-13 are merged. Record the results and update `/accessibility/` (test list, known issues and
review date), saying that the tester was the site's author. A tester from Blind Low Vision NZ is recruited later, as a
separate piece of work. *Done when* the statement names the screen readers used and the date, and every new barrier
found has an issue or a fix.

**SR-2 Welcome window (F2).** Move the screen reader sentence above the choices and add it to the dialog's
`aria-describedby`. Next to "Read the pages aloud to me", say that it is a separate voice from a screen reader.
*Done when* the dialog's accessible description includes the screen reader sentence and the choice explains itself.

**SR-3 Heading first on cards (F3).** *Decided: heading first, on screen too.* In `LabCard`, `PostCard` and
`RepoCard`, the heading comes before the status, category, date and owner, both in the HTML and on screen (rule 18
says the two orders must match). The lab icon may stay beside the heading; it is hidden from screen readers.
*Done when* the text right after each card heading is its status or date, and the order test in `e2e/a11y.spec.ts`
still passes.

**SR-4 Clean heading names (F4).** The new-tab hint on repository card links moves out of the heading's name (for
example, `aria-describedby` pointing to one shared hidden "(opens in a new tab)" element). The link still announces it.
*Done when* no heading's accessible name contains "(opens in a new tab)".

**SR-5 Durations in words (F5).** *Decided: whole words on screen.* `duration()` in `src/lib/format.ts` returns
"8 years 9 months", "1 year", "5 months" (singular for one). *Done when* no text on the page contains "mo" or "yrs" as
words, and a unit test covers the singular and plural cases.

**SR-6 Clear separators (F6).** Status words get a hidden label or punctuation: "DP-300 — Azure Database
Administrator. Status: studying", "In progress. Since Apr 2026", "Business and Technology". *Done when* each item in
the accessibility tree reads as a sentence.

**SR-7 Number read once (F7).** The visible step number in `Spectrum.astro` is hidden from screen readers
(`aria-hidden="true"`), because the ordered list already says "1 of 5".

**SR-8 Labs summary and count (F8).** The summary reads "3 live, 1 in testing, 4 experiments in total" with no
repetition. The count uses the right plural ("1 experiment").

**SR-9 Links that make sense alone (F9).** Lab card links add the lab name for screen readers only: "Code for
BentoPDF", "Read notes on BentoPDF". The visible text stays the same, and the visible words stay at the start of
the accessible name (WCAG 2.5.3, label in name).

**SR-10 Copy confirmation is announced (F10).** "Link copied" and "Copy failed" are also written into a `role="status"`
region.

**SR-11 Message limit announced (F11).** The message field's `aria-describedby` includes a short hint such as
"Up to 5,000 characters". The live counter is not announced on every key press.

**SR-12 Availability under the heading (F12).** *Decided: move it.* In `Hero.astro` the `h1` comes first, then
the availability line, in the HTML and on screen. The greeting ("Kia ora, I'm Carlos.") stays above the `h1` as a
lead-in. *Done when* the text straight after the `h1` in the accessibility tree is the availability line (when
`profile.is_available` is true).

**SR-13 Names in their own language (F13).** *Decided: include now.* Add two optional columns in a new, additive
migration: `experiences.company_lang` and `education.institution_lang`, each `text` and either null or a short
language tag (a `check` constraint such as `~ '^[a-z]{2,3}(-[A-Z]{2})?$'`). The site wraps the name in
`<span lang="…">` when the column is set. Leave it null when the name is written in English (for example
"Pontifical Catholic University of Minas Gerais"); set `pt-BR` for "Drogaria Araujo". The CLI (`content pull` and
`push`), `supabase/seed/content.json`, `src/lib/types.ts`, `src/lib/content.ts` and the tests learn the new fields.
The migration keeps the existing `revoke … from anon, authenticated` pattern, and the pgTAP tests still pass.
*Done when* "Drogaria Araujo" is exposed with `lang="pt-BR"` and a bad tag is rejected by the database and by
`content push --dry-run`.

**SR-14 The hero fits a small screen (F14).** The hero grid uses `minmax(0, 1fr)` columns (rule 11), and its two
buttons may wrap their label onto a second line. The reflow tests also fail when an element is wider than the screen
but hidden by a clip, not only when the page scrolls sideways. *Done when* at 320 px with 200% text and wide spacing
no visible element on any page reaches past the right edge of the screen.

**SR-15 Glossary covers the GitHub languages (F15).** Add "PL/SQL" and "T-SQL" (and "TSQL", the spelling GitHub uses
for the language) to `src/lib/glossary.ts`. *Done when* `e2e/words.spec.ts` passes when built from Supabase as well as
from the seed.

## Commands

```bash
npm run check                 # 0 errors
npm run build
npm run test:contrast
npm run test:a11y             # Playwright + axe-core; the new tests go in here
CONTENT_SOURCE=fixtures INCLUDE_DRAFTS=true npm run build   # to test post pages (SR-10)
uv run ruff check carlos_cms tests && uv run ruff format --check carlos_cms tests && uv run pytest   # SR-13
npx supabase test db          # pgTAP (SR-13)
```

## Project structure (files likely to change)

```
src/components/WelcomeDialog.astro    SR-2
src/components/LabCard.astro          SR-3, SR-9
src/components/PostCard.astro         SR-3
src/components/RepoCard.astro         SR-3, SR-4
src/components/ExperienceTimeline.astro, src/lib/format.ts   SR-5
src/components/NowSection.astro, Hero.astro                  SR-6, SR-12
src/components/Spectrum.astro         SR-7
src/pages/labs/index.astro, src/scripts/labs-filter.ts       SR-8
src/scripts/ui.ts, src/pages/posts/[slug].astro             SR-10
src/pages/contact.astro               SR-11
src/pages/accessibility.astro         SR-1 (statement)
supabase/migrations/<new>.sql, supabase/tests/, supabase/seed/content.json   SR-13
carlos_cms/content.py, tests/          SR-13 (CLI)
src/lib/types.ts, src/lib/content.ts  SR-13
e2e/a11y.spec.ts, e2e/welcome.spec.ts tests
```

## Code style

Follow the existing pattern: native HTML, and ARIA only where HTML cannot say it. Text for screen readers only uses
`sr-only`. Example for SR-9:

```astro
<a href={lab.repo_url} target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center gap-1.5 text-muted hover:text-fg">
  <Icon name="material-symbols:code" class="size-4" aria-hidden="true" />Code<span class="sr-only"> for {lab.name} (opens in a new tab)</span>
</a>
```

New Zealand English in every string and comment. No `style=""`, no `on*=`, no inline `<script>` (CSP).

## Testing strategy

- **Automated (Playwright, `e2e/a11y.spec.ts`):** use `locator.ariaSnapshot()` and the accessibility tree to check:
  no heading name contains "(opens in a new tab)" (SR-4); no accessible text has the words "mo" or "yrs" (SR-5);
  the welcome window's description includes the screen reader sentence (SR-2); on each card the heading comes before
  the status in the tree (SR-3); "Copy link" writes to a status region (SR-10); the labs count is singular for one
  result (SR-8).
- **Existing checks stay green:** axe-core in every theme, reading order on phone and desktop, 44 px targets, reflow.
- **By hand (SR-1):** NVDA + Firefox, VoiceOver + Safari on iOS, following `docs/USER-TESTING.md`.

## Boundaries

- **Always:** keep the HTML order and the screen order the same (rule 18); keep the visible words at the start of
  each accessible name; run the full check list in `CLAUDE.md` before finishing; update `/accessibility/` if what it
  says changes.
- **Ask first:** any visible layout change to the cards or the hero (SR-3, SR-12); any change to the welcome window's
  options; any new dependency.
- **Never:** detect or guess that a visitor uses a screen reader; add an overlay or a third-party widget; use ARIA to
  hide real content; claim "fully accessible" or claim screen reader testing that was not done.

## Success criteria

1. Every item from SR-2 to SR-15 has a passing automated test, and `npm run test:a11y`, `uv run pytest` and the
   pgTAP tests pass.
2. The heading list on `/` and `/labs/` reads as clean titles with no new-tab hints or abbreviations.
3. A person can tell, from the heading of each card alone, the item's name and then its status straight after it.
4. A real screen reader session (SR-1) has been run, recorded and reflected in the accessibility statement.

## Decisions (16 Nov 2026)

1. **Cards (SR-3):** heading first, on screen and in the HTML. The visual change is accepted.
2. **Durations (SR-5):** whole words on screen for everyone.
3. **Hero (SR-12):** the availability line moves under the `h1`.
4. **Real testing (SR-1):** Carlos tests with NVDA and VoiceOver first. A Blind Low Vision NZ tester comes later.
5. **Portuguese names (SR-13):** in scope, with a new optional language column for company and institution.
6. **Found during the work (SR-14, SR-15):** added to phase 3 on 16 Nov 2026.

## Open questions

None.
