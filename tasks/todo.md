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
- [ ] pgTAP: both columns exist, accept `pt-BR` and null, reject `portuguese` (written; not run yet: needs Docker)
- [x] `Experience` and `Education` in `src/lib/types.ts` have the optional fields

**Verification:** `npx supabase test db` · `npm run check` · `npm run build`

**Dependencies:** none

**Files:** `supabase/migrations/20261116000000_name_language.sql`, `supabase/tests/database/security.test.sql` (or a
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
- [ ] pgTAP passes (`npx supabase test db`, needs Docker)
- [ ] Carlos approves `npx supabase db push`, then sets the field with `content pull` / `content push`
- [ ] PR 1 opened and reviewed

---

## Phase 2: what the home page says

### T4: Durations in whole words (SR-5)

**Description:** `duration()` returns "8 years 9 months", "1 year", "1 month".

**Acceptance criteria:**
- [ ] Singular and plural are right for years and months, and the minimum is "1 month"
- [ ] No text on `/` contains the words "mo" or "yrs"

**Verification:** new `e2e/format.spec.ts` (imports `src/lib/format.ts`) · `npm run test:a11y`

**Dependencies:** none

**Files:** `src/lib/format.ts`, `e2e/format.spec.ts`, `e2e/a11y.spec.ts`

**Scope:** S

### T5: Cards put the heading first, keep heading names clean and name their links (SR-3, SR-4, SR-9)

**Description:** In the three cards the heading comes first in the HTML and on screen, then status, category, date
and owner. The repo card's new-tab hint moves to `aria-describedby`. Lab card links "Code" and "Read notes" gain the
lab name in `sr-only` text.

**Acceptance criteria:**
- [ ] On `/`, `/labs/` and `/projects/`, the element after each card heading in the tree is its status or date
- [ ] No heading's accessible name contains "(opens in a new tab)"; the repo links still announce it as a description
- [ ] Lab links read "Code for {name}" and "Read notes on {name}", and the visible word stays at the start of the name

**Verification:** `npm run build` · `npm run test:a11y` (order, reflow at 320 px, targets, focus rings all still pass)

**Dependencies:** none

**Files:** `src/components/LabCard.astro`, `src/components/PostCard.astro`, `src/components/RepoCard.astro`,
`e2e/a11y.spec.ts`

**Scope:** M

### T6: Availability under the main heading (SR-12)

**Description:** In the hero, the `h1` comes before the availability line, in the HTML and on screen; the greeting
stays above the `h1`.

**Acceptance criteria:**
- [ ] With `is_available` true, the text straight after the `h1` is the availability line
- [ ] With `is_available` false, nothing is left in its place

**Verification:** `npm run test:a11y`

**Dependencies:** none

**Files:** `src/components/Hero.astro`, `e2e/a11y.spec.ts`

**Scope:** S

### T7: Clear separators for statuses, and the step number read once (SR-6, SR-7)

**Description:** Hidden labels or punctuation so statuses read as sentences: certifications ("Status: studying"), Now
card footers, the education "In progress" pill and the hero figure ("Business and Technology"). The step number in
"Where I can help" gets `aria-hidden="true"`.

**Acceptance criteria:**
- [ ] The tree reads "… Azure Database Administrator. Status: studying" (pattern, not exact text)
- [ ] Spectrum items no longer expose the bare number
- [ ] No visual change

**Verification:** `npm run test:a11y` · visual comparison by hand in light and dark

**Dependencies:** T3, T4 (they also touch `ExperienceTimeline.astro`)

**Files:** `src/components/NowSection.astro`, `src/components/ExperienceTimeline.astro`, `src/components/Hero.astro`,
`src/components/Spectrum.astro`, `e2e/a11y.spec.ts`

**Scope:** M

### Checkpoint 2
- [ ] All site checks pass
- [ ] Carlos looks at the cards and the hero in light and dark themes, on a phone and on a desktop
- [ ] PR 2 opened and reviewed

---

## Phase 3: interactions

### T8: Welcome window speaks to screen reader users first (SR-2)

**Description:** The screen reader sentence moves above the choices and joins `aria-describedby`. "Read the pages
aloud to me" says it is a separate voice from a screen reader.

**Acceptance criteria:**
- [ ] The dialog's accessible description contains the screen reader sentence
- [ ] The read-aloud choice explains that it is a separate voice
- [ ] All existing tests in `e2e/welcome.spec.ts` pass

**Verification:** `npm run test:a11y`

**Dependencies:** none

**Files:** `src/components/WelcomeDialog.astro`, `e2e/welcome.spec.ts`

**Scope:** S

### T9: Labs summary without repetition, count with the right plural (SR-8)

**Acceptance criteria:**
- [ ] The summary reads "3 live, 1 in testing, 4 experiments in total" with no repeated words
- [ ] The count says "1 experiment" for one and "experiments" otherwise, before and after filtering

**Verification:** `npm run test:a11y`

**Dependencies:** none

**Files:** `src/pages/labs/index.astro`, `src/scripts/labs-filter.ts`, `e2e/a11y.spec.ts`

**Scope:** S

### T10: "Link copied" is announced (SR-10)

**Acceptance criteria:**
- [ ] Pressing "Copy link" writes "Link copied" (or the failure text) into a `role="status"` region
- [ ] The region is empty again after the label resets

**Verification:** build with `CONTENT_SOURCE=fixtures INCLUDE_DRAFTS=true`, then `npm run test:a11y`

**Dependencies:** none

**Files:** `src/scripts/ui.ts`, `src/pages/posts/[slug].astro`, `e2e/a11y.spec.ts`

**Scope:** S

### T11: The message limit is announced on the contact form (SR-11)

**Acceptance criteria:**
- [ ] The message field's description includes "Up to 5,000 characters"
- [ ] The live counter is not announced on every key press
- [ ] The error line is still part of the description when an error shows

**Verification:** `npm run test:a11y`

**Dependencies:** none

**Files:** `src/pages/contact.astro`, `e2e/a11y.spec.ts`

**Scope:** S

### Checkpoint 3
- [ ] All site checks pass
- [ ] `/accessibility/`: the automated test list mentions the new checks; review date updated
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
