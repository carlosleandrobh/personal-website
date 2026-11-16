# Implementation plan: a smoother screen reader experience

Spec: [docs/SPEC-screen-reader.md](../docs/SPEC-screen-reader.md) (approved 16 Nov 2026). Tasks: [todo.md](todo.md).

## Overview

Thirteen requirements remove the friction a screen reader user meets today (SR-2 to SR-13), then Carlos tests the
result with NVDA and VoiceOver (SR-1). Most changes are markup in Astro components with a Playwright test each. One
(SR-13) adds two optional columns to Supabase, so it runs through the database, the CLI and the site.

## Architecture decisions

- **SR-13 goes first.** It is the only change with a migration, a CLI change and production data, so it carries the
  most risk. Doing it first means a problem shows up before the markup work piles on top of it.
- **Language columns are optional and validated twice:** a `check` constraint in Postgres and a matching validator in
  `carlos_cms/content.py`, so `content push --dry-run` rejects a bad tag without touching the database. The site
  reads the columns defensively (`?? null`), so a build against a database without the migration still works.
- **No new test runner.** The `duration()` unit test is a Playwright spec that imports `src/lib/format.ts` directly
  (Playwright compiles TypeScript). Everything else is checked through the accessibility tree
  (`locator.ariaSnapshot()` / accessible names) in `e2e/a11y.spec.ts` and `e2e/welcome.spec.ts`.
- **Visual changes are allowed only where decided:** cards (heading first), durations (whole words) and the hero
  (availability under the `h1`). Everything else is hidden text (`sr-only`), `aria-hidden` or ARIA wiring with no
  visual change.
- **Three pull requests, one per phase,** so each can be reviewed and deployed on its own. The migration in phase 1
  is applied to Supabase (`npx supabase db push`) only after Carlos approves it.

## Dependency graph

```
T1 migration + seed + types ──┬── T2 CLI fields + validator
                              └── T3 render lang spans
T4 durations ─┐
T5 cards ─────┤  (independent of each other; T7 touches ExperienceTimeline after T3 and T4)
T6 hero ──────┤
T7 separators + spectrum number
T8 welcome, T9 labs, T10 copy status, T11 contact hint   (independent)
SR-1 manual test ── needs everything above merged and deployed
```

## Task list

### Phase 1: names in their own language (SR-13), PR 1
- [x] T1: Add the language columns (migration, pgTAP, seed, types)
- [x] T2: Let the CLI pull, validate and push the language columns
- [x] T3: Mark company and institution names with their language on the site

### Checkpoint 1
- [ ] pytest, pgTAP, check, build, test:a11y pass
- [ ] Carlos approves applying the migration to Supabase, sets `company_lang: pt-BR` for Drogaria Araujo

### Phase 2: what the home page says (SR-3, 4, 5, 6, 7, 9, 12), PR 2
- [ ] T4: Durations in whole words
- [ ] T5: Cards put the heading first, keep heading names clean and name their links
- [ ] T6: Availability under the main heading
- [ ] T7: Clear separators for statuses, and the step number read once

### Checkpoint 2
- [ ] All checks pass; Carlos looks at the cards and the hero in light, dark and on a phone

### Phase 3: interactions (SR-2, 8, 10, 11), PR 3
- [ ] T8: Welcome window speaks to screen reader users first
- [ ] T9: Labs summary without repetition, count with the right plural
- [ ] T10: "Link copied" is announced
- [ ] T11: The message limit is announced on the contact form

### Checkpoint 3
- [ ] All checks pass; `/accessibility/` lists the new automated checks and a new review date

### Phase 4: real screen reader test (SR-1), Carlos
- [ ] T12: Test with NVDA + Firefox and VoiceOver + Safari (iPhone); record results in `/accessibility/`

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Production build runs before the migration is applied, and the query asks for a missing column | High | `content.ts` uses `select('*')`-style rows and reads the new fields with `?? null`; apply the migration before merging PR 1 |
| A bad language tag (`pt_br`, `portuguese`) makes the screen reader switch to a wrong or missing voice | Medium | Same regex in Postgres and the CLI; pytest and pgTAP cover a bad value |
| Moving the heading first breaks the reading-order test or the card layout at 320 px / 200% text | Medium | Run the full `test:a11y` (reflow, order, targets) in T5; Carlos reviews visually at checkpoint 2 |
| Whole-word durations wrap the date pill on narrow screens | Low | Reflow test at 320 px; the pill may wrap (it is not a button) |
| Tests written against seed content break when real content changes | Low | Tests look for patterns (no "(opens in a new tab)" in heading names) not exact strings, as `e2e/words.spec.ts` does since PR #27 |
| The statement claims testing that did not happen | Medium | Only T12 changes the "not tested with screen readers" wording, and only after Carlos has tested |

## Open questions

None. The decisions are in the spec.
