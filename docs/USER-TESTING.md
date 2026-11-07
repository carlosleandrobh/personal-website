# Testing carlos.nz with real people

Automated checks (`npm run test:a11y`) cannot say whether the site feels welcoming or whether someone can use it. This
is a short script for testing with people. Do it after any large change to the interface, and at least once a year.
It follows section 7.3 and 7.4 of the long guide.

## Before you start

- Tell each tester what you are testing: **the site, not them**. They can stop at any time.
- Ask before you record anything. Record only with their clear agreement and delete recordings after you have written
  up the notes. Say how long you will keep the notes.
- **Pay people for their time** when they are not already part of your team.
- Testers can come from Blind Low Vision NZ, Deaf Aotearoa, the Dyslexia Foundation of New Zealand or the Disabled
  Persons Assembly NZ, or from people you already know. Three to five people with different needs is enough.

## Tasks (give them one at a time, in the tester's own words)

1. Open carlos.nz. **What do you think this site is for? What do you expect to find?** (Do not mention the welcome
   window. Note what they do when it opens, what they choose and whether the wording makes sense.)
2. Find out what Carlos does for work.
3. Make the text easier for you to read. (Do not say where. Note whether they find *Display settings*.)
4. Find a post about the homelab and read the first few paragraphs.
5. If it is a post with a picture or diagram: **explain what the picture shows**.
6. Look up what "Proxmox VE" means.
7. Send Carlos a message. (Stop before sending. Note any error messages and whether they understood them.)
8. Find how to report something that does not work.

## What to note

| Question | Note |
|---|---|
| Did they feel welcome? What did they say about the first screen? | their own words |
| Where did they get lost, stuck or give up? | page and step |
| Did they find *Display settings* and the *Easy Read* page without help? | yes / no / after how long |
| Welcome window: did it open at a good moment? Did they understand each choice? Did it feel like being asked to label themselves? | their own words |
| Did *Read the pages aloud* start when they expected, and could they pause or stop it? | what happened |
| Did anything read out loud (screen reader, *Listen*) sound wrong or confusing? | what it said |
| Did any control not work with their usual setup? | setup, browser, control |
| Anything they wished the site did? | their own words |

## Assistive technology to cover across testers

| Setup | Browser |
|---|---|
| NVDA (Windows) | Firefox |
| VoiceOver (macOS and iOS) | Safari |
| TalkBack (Android) | Chrome |
| Keyboard only | any |
| Voice Control or Voice Access | Safari or Chrome |
| Zoom to 200% or 400%, or a screen magnifier | any |
| High contrast theme or *Display settings* high contrast | any |

If you cannot recruit testers yet, do the same tasks yourself with NVDA and Firefox, then with VoiceOver on a phone,
and write down what you notice. That is a start, not a replacement for other people.

## After the test

1. Treat each barrier as a bug. Write it down with the page, the setup and what happened.
2. Fix the cause, then add or update an automated check where one can catch it (`e2e/a11y.spec.ts`).
3. Update **Last reviewed**, **How it has been tested** and **Known issues** in `src/pages/accessibility.astro`.
   Say only what was actually tested. If a tester agrees, thank them by role ("a screen reader user"), not by name.
