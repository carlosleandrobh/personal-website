# Tasks: a smoother screen reader experience

Plan: [plan.md](plan.md) · Spec: [docs/SPEC-screen-reader.md](../docs/SPEC-screen-reader.md)

Every task also clears the "Before you finish any change" list in `CLAUDE.md` for the parts it touches.

---

## Phase 1: names in their own language (SR-13)

### T1: Add the language columns

**Description:** New additive migration adding `experiences.company_lang` and `education.institution_lang` (`text`,
null or a language tag matching `^[a-z]{2,3}(-[A-Z]{2})?$`). Seed and types learn the fields; the seed sets `pt-BR`
for Drogaria Araujo.

**Acceptance criteria:**
- [x] The migration only adds columns and keeps grants and RLS unchanged (no access for `anon`/`authenticated`)
- [x] pgTAP: both columns exist, accept `pt-BR` and null, reject `portuguese` (written; the four cases checked on production in a rolled-back block)
- [x] `Experience` and `Education` in `src/lib/types.ts` have the optional fields

**Verification:** `npx supabase test db` · `npm run check` · `npm run build`

**Dependencies:** none

**Files:** `supabase/migrations/20261116040224_name_language.sql`, `supabase/tests/database/security.test.sql` (or a
new test file), `supabase/seed/content.json`, `src/lib/types.ts`

**Scope:** M

### T2: Let the CLI pull, validate and push the language columns

**Description:** Add `company_lang` and `institution_lang` to `TABLES` in `carlos_cms/content.py`, with a validator
that rejects a bad tag before anything is sent (also in `--dry-run`).

**Acceptance criteria:**
- [x] `content pull` writes the fields; `content push` sends only changed ones
- [x] A bad tag stops the push with a clear message naming the row and field
- [x] Tests with the fake client cover a good tag, null and a bad tag

**Verification:** `uv run ruff check carlos_cms tests` · `uv run ruff format --check carlos_cms tests` · `uv run pytest`

**Dependencies:** T1

**Files:** `carlos_cms/content.py`, `tests/test_content.py`

**Scope:** S

### T3: Mark company and institution names with their language

**Description:** Wrap the company (timeline and "Currently" in About's quick facts) and the institution (timeline
education and "Studying") in `<span lang={…}>` when the field is set.

**Acceptance criteria:**
- [x] With the seed, "Drogaria Araujo" is inside an element with `lang="pt-BR"`
- [x] No `lang` attribute is added when the field is null
- [x] Words-on-page and reading aloud still work on the home page

**Verification:** `npm run build` · `npm run test:a11y` (new test in `e2e/a11y.spec.ts`)

**Dependencies:** T1

**Files:** `src/components/ExperienceTimeline.astro`, `src/components/About.astro`, `e2e/a11y.spec.ts`

**Scope:** S

### Checkpoint 1
- [x] pytest (56), `npm run check`, build, `test:contrast`, `test:a11y` (140) pass
- [x] Migration applied to Supabase on 16 Nov 2026 (recorded as version 20261116040224; the file was renamed to match)
- [x] Database checks without Docker, on production: read-only queries (RLS on every table, no grants to client
  roles, both columns and constraints present) and the four new pgTAP cases run in a block that rolls back on purpose
  (all four ok, nothing left behind). The full pgTAP file was **not** run on production: it deletes Vault secrets.
- [x] `experiences.company_lang = 'pt-BR'` set for Drogaria Araujo; a build from Supabase shows `<span lang="pt-BR">`
- [ ] PR 1 opened and reviewed

---

## Phase 2: what the home page says

### T4: Durations in whole words (SR-5)

**Description:** `duration()` returns "8 years 9 months", "1 year", "1 month". It now reads dates in UTC: a build
west of UTC (Carlos's computer is on Brasília time) used to count one month too many.

**Acceptance criteria:**
- [x] Singular and plural are right for years and months, and the minimum is "1 month"
- [x] No text on `/` contains the words "mo" or "yrs"

**Verification:** new `e2e/format.spec.ts` (imports `src/lib/format.ts`) · `npm run test:a11y`

**Dependencies:** none

**Files:** `src/lib/format.ts`, `e2e/format.spec.ts`, `e2e/a11y.spec.ts`

**Scope:** S

### T5: Cards put the heading first, keep heading names clean and name their links (SR-3, SR-4, SR-9)

**Description:** In the three cards the heading comes first in the HTML and on screen, then status, category, date
and owner. The repo card's new-tab hint moves to `aria-describedby`. Lab card links "Code" and "Read notes" gain the
lab name in `sr-only` text.

**Acceptance criteria:**
- [x] On `/`, `/labs/` and `/projects/`, the element after each card heading in the tree is its status or date
- [x] No heading's accessible name contains "(opens in a new tab)"; the repo links still announce it as a description
- [x] Lab links read "Code for {name}" and "Read notes on {name}", and the visible word stays at the start of the name

**Verification:** `npm run build` · `npm run test:a11y` (order, reflow at 320 px, targets, focus rings all still pass)

**Dependencies:** none

**Files:** `src/components/LabCard.astro`, `src/components/PostCard.astro`, `src/components/RepoCard.astro`,
`e2e/a11y.spec.ts`

**Scope:** M

### T6: Availability under the main heading (SR-12)

**Description:** In the hero, the `h1` comes before the availability line, in the HTML and on screen; the greeting
stays above the `h1`.

**Acceptance criteria:**
- [x] With `is_available` true, the text straight after the `h1` is the availability line
- [x] With `is_available` false, nothing is left in its place

**Verification:** `npm run test:a11y`

**Dependencies:** none

**Files:** `src/components/Hero.astro`, `e2e/a11y.spec.ts`

**Scope:** S

### T7: Clear separators for statuses, and the step number read once (SR-6, SR-7)

**Description:** Hidden labels or punctuation so statuses read as sentences: certifications ("Status: studying"), Now
card footers, the education "In progress" pill and the hero figure ("Business and Technology"). The step number in
"Where I can help" gets `aria-hidden="true"`.

**Acceptance criteria:**
- [x] The tree reads "… Azure Database Administrator. Status: studying" (pattern, not exact text)
- [x] Spectrum items no longer expose the bare number
- [x] No visual change

**Verification:** `npm run test:a11y` · visual comparison by hand in light and dark

**Dependencies:** T3, T4 (they also touch `ExperienceTimeline.astro`)

**Files:** `src/components/NowSection.astro`, `src/components/ExperienceTimeline.astro`, `src/components/Hero.astro`,
`src/components/Spectrum.astro`, `e2e/a11y.spec.ts`

**Scope:** M

### Checkpoint 2
- [x] All site checks pass: check (0 errors), contrast (0), test:a11y 152/152 on the seed. Against real content the only
  failures are tests that need posts (none published yet) and PL/TSQL from GitHub data missing in the glossary (both
  were there before this phase)
- [ ] Carlos looks at the cards and the hero in light and dark themes, on a phone and on a desktop
- [ ] PR 2 opened and reviewed

---

## Phase 3: interactions

### T8: Welcome window speaks to screen reader users first (SR-2)

**Description:** The screen reader sentence moves above the choices and joins `aria-describedby`. "Read the pages
aloud to me" says it is a separate voice from a screen reader.

**Acceptance criteria:**
- [x] The dialog's accessible description contains the screen reader sentence
- [x] The read-aloud choice explains that it is a separate voice
- [x] All existing tests in `e2e/welcome.spec.ts` pass

**Verification:** `npm run test:a11y`

**Dependencies:** none

**Files:** `src/components/WelcomeDialog.astro`, `e2e/welcome.spec.ts`

**Scope:** S

### T9: Labs summary without repetition, count with the right plural (SR-8)

**Acceptance criteria:**
- [x] The summary reads "3 live, 1 in testing, 4 experiments in total" with no repeated words
- [x] The count says "1 experiment" for one and "experiments" otherwise, before and after filtering

**Verification:** `npm run test:a11y`

**Dependencies:** none

**Files:** `src/pages/labs/index.astro`, `src/scripts/labs-filter.ts`, `e2e/a11y.spec.ts`

**Scope:** S

### T10: "Link copied" is announced (SR-10)

**Acceptance criteria:**
- [x] Pressing "Copy link" writes "Link copied" (or the failure text) into a `role="status"` region
- [x] The region is empty again after the label resets

**Verification:** build with `CONTENT_SOURCE=fixtures INCLUDE_DRAFTS=true`, then `npm run test:a11y`

**Dependencies:** none

**Files:** `src/scripts/ui.ts`, `src/pages/posts/[slug].astro`, `e2e/a11y.spec.ts`

**Scope:** S

### T11: The message limit is announced on the contact form (SR-11)

**Acceptance criteria:**
- [x] The message field's description includes "Up to 5,000 characters"
- [x] The live counter is not announced on every key press
- [x] The error line is still part of the description when an error shows
- [x] Found on the way: the hidden error line always held "Error: ", so every contact field was described as "Error:"
  before anything went wrong. The prefix is now written only while there is an error (test added)

**Verification:** `npm run test:a11y`

**Dependencies:** none

**Files:** `src/pages/contact.astro`, `e2e/a11y.spec.ts`

**Scope:** S

### T13: The hero fits a 320 px screen at 200% text, and the reflow test catches clipped content (SR-14) — moved to phase 3b

> **Moved to phase 3b on 16 Nov 2026.** The new check found cut-off content on almost every page at 200% text (worst:
> /privacy/ 388 px, Easy Read 189 px, home 117 px; at the normal size only the privacy table, 34 px). Causes: buttons
> never wrap, grids with `auto` columns, and a table outside a scrolling box. Carlos chose a separate PR, and approved
> changing rule 11 so buttons wrap only when they would not fit.

**Description:** Found at checkpoint 2. The hero column grows to the width of the "See my work" button and `<main>`
clips it, so the heading is cut off. Give the hero grid `minmax(0, 1fr)` columns and let its buttons wrap. Teach the
reflow tests to look for visible elements past the right edge, not only for a scrolling page.

**Acceptance criteria:**
- [ ] At 320 px with 200% text and wide spacing, no visible element on any page reaches past the right edge
- [ ] The hero buttons stay at least 44 px tall and keep their focus rings
- [ ] The new check fails on the old hero (proved before the fix)

**Verification:** `npm run test:a11y`; screenshot at 320 px with 200% text

**Dependencies:** none

**Files:** `src/components/Hero.astro`, `src/styles/global.css` (if the wrap rule lives there), `e2e/a11y.spec.ts`

**Scope:** S

### T14: The glossary explains PL/SQL and T-SQL (SR-15)

**Acceptance criteria:**
- [x] "PL/SQL", "T-SQL" and the GitHub spelling "TSQL" have plain meanings in `src/lib/glossary.ts`
- [x] `e2e/words.spec.ts` passes when built from Supabase

**Verification:** `npm run build` (from Supabase) then `npx playwright test e2e/words.spec.ts`

**Dependencies:** none

**Files:** `src/lib/glossary.ts`

**Scope:** XS

### Checkpoint 3
- [x] All site checks pass: check (0 errors), contrast (0), test:a11y 159/159 on the seed, pytest 56; words tests
  also pass on a build from Supabase
- [x] `/accessibility/`: the automated test list mentions the new checks; review date 16 Nov 2026; the 320 px claim is
  corrected and the cut-off text is listed as a known issue until phase 3b
- [ ] PR 3 opened and reviewed

---

## Phase 4: real screen reader test (SR-1)

### T12: Carlos tests with NVDA and VoiceOver

**Description:** After PRs 1–3 are deployed, Carlos runs the tasks in `docs/USER-TESTING.md` with NVDA + Firefox and
VoiceOver + Safari on iPhone, on `/`, `/labs/`, a post, `/contact/` and the welcome window.

**Acceptance criteria:**
- [ ] Results recorded (what worked, what was confusing)
- [ ] `/accessibility/` names the screen readers, the date and that the author did the test; the "not tested with
  screen readers" wording is updated to match
- [ ] Each new barrier has a fix or an issue

**Dependencies:** Checkpoint 3

**Files:** `src/pages/accessibility.astro`, `docs/ACCESSIBILITY.md` if a new rule comes out of it

**Scope:** S (plus Carlos's testing time)
