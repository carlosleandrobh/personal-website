---
name: glossary
description: Keep the glossary (src/lib/glossary.ts) in step with the text of carlos.nz. Use whenever site text changes - a post is written or published, profile, experience, labs or "now" content is edited, or the copy in a .astro page changes - and whenever a term is added to or removed from the glossary.
---

# Keeping the glossary in step with the site

The glossary at `/glossary/` and the "Words on this page" list at the end of every page both come from `GLOSSARY` in
`src/lib/glossary.ts`. The rule has two directions:

- **A term is in the glossary because a page uses it.** When the site's text starts using an abbreviation or a
  technical term a reader may not know, add it.
- **A term no page uses is removed.** A glossary that lists words the site never says is noise, and it goes stale.

The real site is the judge: the pages built from the real content in Supabase. The test content
(`supabase/seed/content.json`) is not the site's text. It must never be the reason a term is added, kept or removed.

## When to do this

- Before publishing a post, and after editing one that is already published.
- After `uv run cms content push`, or any other change to the profile, experience, labs, "now" or certifications.
- After changing the copy in a `.astro` page (the accessibility statement, the privacy notice, Easy Read…).
- Before finishing any change to `src/lib/glossary.ts` itself.

## Steps

1. **Build from the real content, then check.** This needs the `.env` with the Supabase secrets.

   ```bash
   npm run build
   npm run test:glossary
   ```

   To include a post that is still a draft (do this just before publishing it):

   ```bash
   INCLUDE_DRAFTS=true npm run build && npm run test:glossary
   ```

   The check reads every page in `dist/` except the glossary itself, the LinkedIn callback and the 404 page. It
   prints `0 missing, 0 unused` when the glossary is in step.

2. **Fix what it reports.**
   - *"X is used on /page/ but is not in the glossary"*: add an entry to `GLOSSARY`. If X is a name, a place or a
     word everyone knows (IBM, NZ, PDF), add it to `NOT_JARGON` instead.
   - *"X is in the glossary but no page uses it"*: delete the entry. Do not keep it "for later": it comes back when
     the text does.

3. **Read the changed text yourself for terms the check cannot see.** The check finds *abbreviations* (two or more
   capitals or digits: ERP, T-SQL, DP-300). It cannot know that an ordinary-looking word is jargon. Read the new or
   changed text and add any technical or business term a general reader may not know ("Homelab", "Screen reader",
   "Power BI"). The "unused" direction does cover every entry, whatever its shape.

4. **Write each meaning in plain language.** One or two short sentences, New Zealand English, no jargon that is not
   itself in the list. If the term is an abbreviation, give what the letters stand for in `expansion`. After removing
   an entry, search the other meanings for the removed word and reword them.

5. **Keep the list in alphabetical order** in the file (the pages sort it anyway, but the file is read by people).

6. **Check with the test content too**, because that is what CI builds:

   ```bash
   CONTENT_SOURCE=fixtures INCLUDE_DRAFTS=true npm run build && CONTENT_SOURCE=fixtures npm run test:glossary
   ```

   With the fixtures only "missing" is checked. If an abbreviation is reported that only the test content uses, add
   it to `FIXTURE_ONLY` in `src/lib/glossary.ts`, not to `GLOSSARY`. Remove it from `FIXTURE_ONLY` when the fixtures
   stop using it.

7. Run the usual site checks before finishing (`npm run check`, `npm run test:contrast`, `npm run test:a11y`).

## Where it is checked automatically

- **CI** (pull requests, test content): `npm run test:glossary` fails on a missing abbreviation, and
  `e2e/words.spec.ts` checks the same in a real browser.
- **Deploy** (real content, published posts only): the check runs after the build and reports each problem as a
  warning on the run, in both directions. It does not stop the deploy, so a post is never held back by a missing
  entry. A warning there means: do the steps above and open a pull request.

## Do not

- Add a term because the fixtures use it, or keep one because a draft might use it one day.
- Explain a term only in a tooltip or a `title` attribute. The meaning is plain text on the page.
- Put the list of names (`NOT_JARGON`) anywhere but `src/lib/glossary.ts`.
