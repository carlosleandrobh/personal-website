# carlos.nz — Accessibility, Security and Privacy Implementation Guide

| | |
|---|---|
| Repository | `personal-website` |
| Suggested path | `docs/accessibility-security-privacy-guide.md` |
| Owner | Carlos |
| Version | 1.0 — 5 November 2026 |
| Next review | May 2027, or sooner if WCAG, the Privacy Act, the threat landscape or the stack changes |
| Status | Binding for every change to the site |

> This guide is engineering guidance, not legal advice. Where it summarises New Zealand law, check the linked source (§10) or get advice before relying on it.

> **Status of this document in the repository:** it is a **reference**, not the working rulebook. It was written for a
> Jinja2/Python build, a Cloudflare Worker contact endpoint, a `site.yml` workflow and a `design/tokens.json` palette.
> This repository is an Astro site with a Supabase Edge Function, `deploy.yml` and the tokens in
> `src/styles/global.css`, so the code in §4.1 to §5.3, §5.7 and §7 does not apply as written. The rules that apply to
> this repository are in [ACCESSIBILITY.md](ACCESSIBILITY.md) and [SECURITY-AND-PRIVACY.md](SECURITY-AND-PRIVACY.md).
> Where they disagree with this guide (for example the IP address hash in SEC-27, or the script loading in SEC-32),
> they win.

## Contents

0. [How to use this guide](#0-how-to-use-this-guide)
1. [Goals, targets and principles](#1-goals-targets-and-principles)
2. [Target architecture and trust boundaries](#2-target-architecture-and-trust-boundaries)
3. [Implementation roadmap (evidence-ranked)](#3-implementation-roadmap-evidence-ranked)
4. [Accessibility rules](#4-accessibility-rules)
5. [Security rules (OWASP Top 10:2025)](#5-security-rules-owasp-top-102025)
6. [Privacy and New Zealand law](#6-privacy-and-new-zealand-law)
7. [Testing and verification](#7-testing-and-verification)
8. [Definition of done](#8-definition-of-done)
9. [Accessibility statement template](#9-accessibility-statement-template)
10. [Evidence base and sources](#10-evidence-base-and-sources)
11. [Change log](#11-change-log)

---

## 0. How to use this guide

### 0.1 Instructions for Claude Code

Add this line to `CLAUDE.md` at the repository root:

```markdown
Follow docs/accessibility-security-privacy-guide.md for every change to templates, styles, scripts, content schema, the build, CI, Cloudflare settings or the contact endpoint. Cite rule IDs (for example A11Y-31, SEC-22) in commit messages and pull request descriptions.
```

Rule keywords:

- **MUST / MUST NOT**: non-negotiable.
- **SHOULD / SHOULD NOT**: the default. A deviation needs a written reason in the pull request.
- **MAY**: optional.

| ID | Rule |
|---|---|
| GOV-01 | MUST NOT weaken, skip or delete a rule, test, CSP directive or CI check to make a build pass. Fix the cause. |
| GOV-02 | MUST stop and ask Carlos before: adding any third-party script, font, embed, service or analytics; changing what personal information is collected, where it is stored or for how long; publishing homelab details (addresses, hostnames, versions, screenshots of terminals or dashboards); publishing any claim of accessibility conformance; or deciding anything listed in §0.3. |
| GOV-03 | MUST treat code from Google Stitch, AI assistants (including Claude Code itself) and copied snippets as unaudited until it passes §7 and the §8 checklist. Typical defects to look for: `outline: none`, low-contrast greys, `div` used as a button, fixed pixel heights, missing labels. |
| GOV-04 | MUST write all site content, code comments, commit messages and documentation in New Zealand English: colour, organisation, centre, licence (noun) and license (verb), programme (but computer *program*), *-ise* endings. Code identifiers keep their standard spelling (for example CSS `color`). |
| GOV-05 | MUST NOT trade an accessibility requirement for a security control, or the reverse. Find a design that meets both (§5.3 shows the pattern for the contact form) or stop and ask. |
| GOV-06 | MUST prefer the platform: native HTML elements and browser or OS features come before custom widgets. Use no ARIA where native semantics exist. |
| GOV-07 | MUST keep the site fully usable without any optional feature, such as the display settings panel or JavaScript enhancements. |

### 0.2 Notes for Carlos

- §3 sets the order of work. It comes from the evidence-weighted ranking (impact, strength of scientific evidence, breadth of disabilities served), with a security rating based on OWASP Top 10:2025 added.
- Every rule has an ID. Claude Code cites the IDs and you can review against them quickly.
- The code snippets are reference patterns. Python, JavaScript, TypeScript, SQL, YAML and CSS were checked for syntax, and the contrast values were computed with the WCAG 2.2 formula. Adapt names and paths to the repository.

### 0.3 Decisions only Carlos can make

Claude Code MUST NOT guess these. Until a decision is recorded here, use the proposed default only in drafts and flag it.

| ID | Decision | Proposed default | Affects |
|---|---|---|---|
| D1 | How long to keep contact messages | 12 months, then automatic deletion | PRIV-07, §6.5 |
| D2 | Public email address | A dedicated alias on `carlos.nz` (Cloudflare Email Routing) that you can rotate, not your personal inbox | A11Y-84, LAW-02, §9 |
| D3 | Analytics | None. If needed: Cloudflare Web Analytics (cookieless), with no custom events | PRIV-12, SEC-52 |
| D4 | Contact endpoint platform | Cloudflare Worker on the same origin (`carlos.nz/api/contact`) | §5.3 |
| D5 | Does any page read Supabase from the browser today? | Find out first, then move it to build time | SEC-10 |
| D6 | NZSL video and Easy Read page | Easy Read: yes (phase 3). NZSL: only if you target Deaf clients or employers | A11Y-93, INNOV-21 |
| D7 | Reply time stated on the contact page | For example "I usually reply within 3 working days" | A11Y-84 |
| D8 | Domains in use | `carlos.nz` only, or also `www.carlos.nz` and subdomains? | SEC-20, SEC-54 |

---

## 1. Goals, targets and principles

### 1.1 Goal

Anyone, whatever their impairment, can find out who Carlos is, what he does, his experience, projects and homelab labs, and contact him. They can do this with their own assistive technology and settings, without needing a special mode.

### 1.2 Conformance target

- **Baseline (MUST): WCAG 2.2 Level AA.** This matches the NZ Government Web Accessibility Standard 1.2, which government agencies have had to meet since 17 March 2025. The standard does not legally apply to a personal site. It is used here as the local benchmark.
- **Selected AAA criteria (SHOULD):**
  - 1.4.6 Contrast (Enhanced): 7:1 for body text.
  - 1.4.8 Visual Presentation (partial): line length, spacing, no justified text.
  - 2.3.3 Animation from Interactions.
  - 2.4.8 Location: current page indicator.
  - 2.4.9 Link Purpose (Link Only).
  - 2.4.10 Section Headings.
  - 2.4.13 Focus Appearance.
  - 2.5.5 Target Size (Enhanced): 44 × 44 CSS px for primary controls.
  - 3.1.3 Unusual Words, 3.1.4 Abbreviations and 3.1.5 Reading Level: summaries, a glossary and an Easy Read page.
  - 1.2.6 Sign Language: only if D6 is yes.
- **W3C COGA "Making Content Usable"** patterns, for people with cognitive and learning disabilities.
- **WCAG 3.0** is still a Working Draft, and its contrast method is undecided. The site MUST NOT claim conformance to it. APCA MAY be used as a secondary design check, never instead of the WCAG 2.2 ratios.

### 1.3 Innovation principles

| ID | Principle |
|---|---|
| P1 | **Evidence first.** A feature ships when evidence shows it helps disabled people (§3, §10). Novelty is not a reason. |
| P2 | **Native and additive.** Innovations change presentation through HTML and CSS only. They never fight assistive technology and are never required. |
| P3 | **User-controlled, never inferred.** The site never detects or guesses disability or assistive technology. |
| P4 | **Nothing leaves the browser.** Accessibility preferences are not sent, logged or measured. |
| P5 | **Learn through feedback, not tracking.** Ask people: through the accessibility feedback channel and through paid user testing. |

### 1.4 Decided out of scope

The site will not have:

- accessibility overlays or widgets;
- custom voice control;
- an AI chatbot;
- assistive-technology detection;
- visual or puzzle CAPTCHAs;
- dyslexia fonts as the default;
- public comments or other user-generated content.

The reasons are in §4.19.

---

## 2. Target architecture and trust boundaries

```text
                         build time only (secret key in GitHub Actions secrets)
 Supabase (private) ──────────────────────────────────────────► GitHub Actions
   posts, projects, labs, media                                   Python build: fetch → validate →
   contact_messages (no public access)                            sanitise → render → guard → test
        ▲                                                                 │ deploy
        │ secret key (Worker secret)                                      ▼
 Cloudflare Worker ◄── POST /api/contact ── Visitor ──HTTPS──► Cloudflare: DNS, proxy, security
   validates input, Turnstile siteverify      browser            headers, WAF rate limit, Turnstile
                                                                          │
                                                                          ▼
                                                                  GitHub Pages (static files)
```

| Boundary | What crosses it | Main controls |
|---|---|---|
| TB1 Visitor → Worker | Untrusted form input | SEC-20 to SEC-32 |
| TB2 Supabase → build | Your own content, which could be tampered with if the Supabase account is compromised | SEC-01 to SEC-07, SEC-40 to SEC-47 |
| TB3 Third-party code → CI | GitHub Actions, pip and npm packages | SEC-70 to SEC-79 |
| TB4 Third-party code → visitor | Turnstile (contact page only); Cloudflare Web Analytics only if D3 says yes | SEC-50 to SEC-63 |

---

## 3. Implementation roadmap (evidence-ranked)

How the scores work:

- **Score** = (0.25 × Impact + 0.25 × Evidence + 0.20 × Breadth + 0.10 × Content fit + 0.10 × Stack fit + 0.10 × Norms and innovation) × 20. Each criterion is scored 1–5.
- Items with evidence of net harm are vetoed and go to the bottom.
- **Security** is the risk the feature adds when it is built according to this guide (OWASP Top 10:2025).

Phases:

- **1**: before any other new feature.
- **2**: next.
- **3**: innovation, only after phases 1 and 2 pass §8.
- **C**: conditional.
- **✗**: do not build.

| # | Feature | Score | Evidence | Security | Phase | Rules |
|---|---|---|---|---|---|---|
| 1 | Semantic HTML, landmarks, heading hierarchy | 100 | Strong | None | 1 | A11Y-01 to 03, 09 |
| 2 | Colour contrast; never colour alone | 96 | Strong | None | 1 | A11Y-11 to 15 |
| 3 | Resizable text, reflow, adjustable spacing, legible typography | 95 | Strong | None | 1 | A11Y-20 to 25 |
| 4 | Keyboard operation; visible, unobscured focus | 91 | Moderate–strong | None | 1 | A11Y-30 to 34 |
| 5 | Accessible contact form; anti-spam without cognitive tests | 88 | Strong | Medium (controlled) | 1 | A11Y-80 to 85, SEC-20 to 32 |
| 6 | Alt text and long descriptions for technical diagrams | 87 | Strong/moderate | Medium (information disclosure) | 1 | A11Y-60 to 65, SEC-40 to 45 |
| 7 | Consistent navigation and help | 86 | Moderate–strong | None | 1 | A11Y-07 |
| 8 | Language, page titles, link purpose | 86 | Strong | None | 1 | A11Y-04 to 06 |
| 9 | Plain language, scannable content | 84 | Moderate–strong | None | 1 | A11Y-90 to 94 |
| 10 | Captions, transcripts, audio description (when video exists) | 82 | Strong | Low (embeds) | C | A11Y-110, 111 |
| 11 | Reduced motion; no autoplay or parallax | 80 | Moderate | None | 1 | A11Y-40 to 42 |
| 12 | Target size; touch and mobile | 80 | Moderate–strong | None | 1 | A11Y-45, 46 |
| 13 | System preferences: themes, `prefers-contrast`, `forced-colors` | 79 | Moderate | Low (privacy) | 2 | A11Y-50 to 54, PRIV-10 |
| 14 | CV in HTML first; tagged PDF as the alternative | 78 | Strong | Low | 2 | A11Y-100 to 102, SEC-07, SEC-46, SEC-47 |
| 15 | Skip link | 77 | Strong | None | 1 | A11Y-08 |
| 16 | Accessible name matches visible label (voice control) | 75 | Moderate | None | 2 | A11Y-35 |
| 17 | Accessible code blocks | 73 | Moderate | Medium (information disclosure) | 2 | A11Y-70 to 75, SEC-40 |
| 18 | Markup that works with browser Reader Mode | 72 | Moderate | None | 2 | A11Y-09 |
| 19 | Performance as accessibility | 70 | Moderate | Reduces risk | 2 | A11Y-125 to 127 |
| 20 | No cookie banner | 70 | Moderate | Reduces risk | 2 | PRIV-11, PRIV-12 |
| 21 | Accessibility statement and feedback channel | 69 | Limited (strong as practice) | Low (Fair Trading Act) | 2 | A11Y-130, 131, LAW-02 |
| 22 | Native display settings panel | 67 | Limited/indirect | Low | 3 | INNOV-01 to 07 |
| 23 | LinkedIn and GitHub content as own HTML, no iframes | 66 | Moderate | Reduces risk | 2 | A11Y-120, 121, SEC-04, SEC-62 |
| 24 | Easy Read version of the About page | 62 | Moderate (for the target group) | None | 3 | A11Y-93 |
| 25 | AI-drafted image descriptions with mandatory human review | 57 | Limited–moderate | Low | 3 | INNOV-10 to 14 |
| 26 | Te reo Māori markup and greeting | 54 | Limited | None | 3 | A11Y-04, INNOV-20 |
| 27 | Own "Listen" (read-aloud) button | 54 | Limited | Very low | C | INNOV-08 |
| 28 | NZSL video summary | 49 | Limited | Low | C (D6) | INNOV-21 |
| 29 | Reading ruler | 41 | Limited | — | Inside #22 only, off by default | INNOV-07 |
| 30 | WAI-Adapt / Personalization Semantics | 38 | Limited | — | Watch | §6.8 |
| 31 | Dyslexia font (OpenDyslexic, Dyslexie) as default | 34 | Contrary | — | ✗ | INNOV-06, §4.19 |
| 32 | Custom voice navigation | 32 | Limited | Medium (privacy) | ✗ | §4.19 |
| 33 | AI chatbot ("ask Carlos") | 32 | Limited | High | ✗ | §4.19 |
| 34 | Sonification and haptics | 31 | Limited | — | ✗ (revisit if data charts arrive) | §4.19 |
| 35 | Visual or puzzle CAPTCHA (e.g. reCAPTCHA v2) | 28 (veto) | Evidence of harm | Privacy | ✗ | §4.19 |
| 36 | Accessibility overlays (accessiBe, UserWay, AudioEye and similar) | 24 (veto) | Evidence of harm | High | ✗ | SEC-63, §4.19 |

**Evidence highlights.** Full references are in §10.

- **Headings.** 67.8% of screen reader users start finding information by navigating headings. 83.9% say better websites would help more than better assistive technology (WebAIM Screen Reader User Survey #11, 2026, n = 1,780).
- **The state of the web.** 95.9% of the top one million home pages have detectable WCAG failures (WebAIM Million 2026). The most common:
  - low-contrast text: 83.9%;
  - missing alt text: 53.1%;
  - unlabelled form fields: 51%;
  - empty links: 46.3%;
  - empty buttons: 30.6%;
  - missing document language: 13.5%.
- **Low vision.** 44% use browser zoom. 51.4% use a high-contrast mode, and 71.2% of those prefer light text on a dark background (WebAIM Low Vision Survey #2).
- **Spacing and size.**
  - Extra letter spacing increased reading speed by more than 20% in children with dyslexia (Zorzi et al., PNAS 2012).
  - Readability and comprehension improved up to 18 pt (Rello, Pielot & Marcos, CHI 2016, n = 104).
- **Typefaces.**
  - Sans-serif, monospaced and roman (non-italic) fonts beat serif, proportional and italic fonts; OpenDyslexic gave no benefit (Rello & Baeza-Yates, ACM TACCESS 2016).
  - Wery & Diliberto (2017) and Kuster et al. (2018) found no gain from dyslexia fonts.
- **Polarity.** Dark text on a light background gives better legibility for both younger and older adults (Piepenbrock et al., Ergonomics 2013). So: light by default, with dark and high-contrast themes available.
- **PDFs.** 85.6% of screen reader users expect significant accessibility problems with PDFs. 37.7% use skip links always or often (SR Survey #11).
- **Overlays.**
  - Blind and low-vision users reported that overlays were unhelpful and made problems worse (Makati, Tigwell & Shinohara, ASSETS 2024).
  - The US FTC's final order of April 2025 required accessiBe to pay US$1 million over deceptive claims.
- **AI.** 60.1% of screen reader users already use AI to describe images (SR Survey #11). What the site adds is the author's correct, contextual description.
- **New Zealand.** 17% of people in NZ households are disabled, rising to 35% of those aged 65 and over (Stats NZ, 2023 Household Disability Survey).

---

## 4. Accessibility rules

### 4.1 Structure, navigation and language (#1, #7, #8, #15, #18)

| ID | Rule |
|---|---|
| A11Y-01 | MUST: one `h1` per page that names the page. Headings are nested in order, without skipping levels. Markdown post bodies start at `h2` (the renderer in §5.1 drops `h1`). |
| A11Y-02 | MUST: landmarks are `header`, `nav aria-label="Main"`, a single `main id="main"` and `footer`. |
| A11Y-03 | MUST: native elements. `a href` navigates and `button` acts. No click handlers on `div` or `span`; no positive `tabindex`. |
| A11Y-04 | MUST: `<html lang="en-NZ">`. Other languages are marked inline: `lang="mi"` for te reo Māori (with correct macrons: Māori, Tāmaki Makaurau) and `lang="pt-BR"` for Portuguese. |
| A11Y-05 | MUST: every page has a unique `<title>` in the form "Page — Carlos \| carlos.nz". |
| A11Y-06 | MUST: link text makes sense on its own ("View the homelab-proxmox repository on GitHub", not "click here"). Links open in the same tab. |
| A11Y-07 | MUST: the same navigation items, in the same order and with the same labels, on every page. The current page is marked `aria-current="page"`. The Contact link is in the same place on every page (WCAG 3.2.6). |
| A11Y-08 | MUST: a "Skip to main content" link is the first focusable element and becomes visible on focus. |
| A11Y-09 | MUST: main content is in the server-rendered HTML, never injected on the client. Posts use `article`, `h1`, an author and `<time datetime>`, so browser Reader Mode and built-in read-aloud work. |
| A11Y-10 | MUST NOT: change context on focus or input. No auto-submitting controls, no automatic redirects or refreshes. |

Base template (Jinja2, autoescaping on; SEC-01):

```html
<!doctype html>
<html lang="en-NZ">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ page_title }} — Carlos | carlos.nz</title>
  <script src="/assets/js/prefs-early.js"></script>
  <link rel="stylesheet" href="/assets/css/site.css">
  <script src="/assets/js/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to main content</a>
  <header class="site-header">
    <a class="site-name" href="/">Carlos</a>
    <nav aria-label="Main">
      <ul>
        {% for item in nav %}
        <li><a href="{{ item.url }}"{% if item.url == current_url %} aria-current="page"{% endif %}>{{ item.label }}</a></li>
        {% endfor %}
      </ul>
    </nav>
    <button type="button" id="display-settings-open" class="icon-button"
            aria-haspopup="dialog" aria-controls="display-settings" hidden>Display settings</button>
  </header>
  <main id="main" tabindex="-1">
    {% block content %}{% endblock %}
  </main>
  <footer>
    <a href="/contact/">Contact</a> · <a href="/accessibility/">Accessibility</a> · <a href="/privacy/">Privacy</a>
  </footer>
  <p id="sr-status" class="visually-hidden" role="status"></p>
  {% include "display-settings.html" %}
</body>
</html>
```

`prefs-early.js` is a small external script that blocks rendering on purpose. It applies saved display settings before first paint without needing an inline script, which a strict CSP would block (SEC-53).

### 4.2 Colour and contrast (#2)

| ID | Rule |
|---|---|
| A11Y-11 | MUST: in every theme, text is at least 4.5:1 (large text at least 3:1), and UI component boundaries, focus indicators and meaningful graphics are at least 3:1. |
| A11Y-12 | SHOULD: body text is at least 7:1. |
| A11Y-13 | MUST: colours exist only as design tokens in `design/tokens.json`, exposed as CSS custom properties. CI checks every pair below (`scripts/check_contrast.py`). |
| A11Y-14 | MUST: links in running text are underlined. State and status are never shown by colour alone; diagram node status also uses text labels or icons. |
| A11Y-15 | MUST: re-validate any palette exported from Google Stitch before using it. |

Verified palette. Ratios use the WCAG 2.2 formula and show the lower result against `--bg` and `--surface`.

| Token | Light | Dark | High contrast | Lowest ratio (light / dark / HC) |
|---|---|---|---|---|
| `--bg` | `#ffffff` | `#0f1419` | `#000000` | — |
| `--surface` (cards, code) | `#f4f6f8` | `#1a2028` | `#000000` | — |
| `--fg` (body text) | `#1b1f24` | `#e8eaed` | `#ffffff` | 15.29 / 13.60 / 21.00 |
| `--muted` (secondary text) | `#4b5563` | `#b8bec6` | `#ffffff` | 6.98 / 8.76 / 21.00 |
| `--link`, `--focus` | `#0a50c2` | `#8ab4f8` | `#ffff00` | 6.59 / 7.78 / 19.56 |
| `--link-visited` | `#6b21a8` | `#d7aefb` | `#ff99ff` | 8.05 / 8.85 / 11.25 |
| `--border` (UI boundaries) | `#6b7280` | `#8b949e` | `#ffffff` | 4.46 / 5.33 / 21.00 |
| `--error` | `#b3261e` | `#f2b8b5` | `#ff9999` | 6.03 / 9.60 / 10.27 |

`design/tokens.json`:

```json
{
  "light": {"bg": "#ffffff", "surface": "#f4f6f8", "fg": "#1b1f24", "muted": "#4b5563", "link": "#0a50c2", "link-visited": "#6b21a8", "focus": "#0a50c2", "border": "#6b7280", "error": "#b3261e"},
  "dark": {"bg": "#0f1419", "surface": "#1a2028", "fg": "#e8eaed", "muted": "#b8bec6", "link": "#8ab4f8", "link-visited": "#d7aefb", "focus": "#8ab4f8", "border": "#8b949e", "error": "#f2b8b5"},
  "high-contrast": {"bg": "#000000", "surface": "#000000", "fg": "#ffffff", "muted": "#ffffff", "link": "#ffff00", "link-visited": "#ff99ff", "focus": "#ffff00", "border": "#ffffff", "error": "#ff9999"}
}
```

`scripts/check_contrast.py` checks the design tokens and the syntax-highlighting styles (A11Y-71):

```python
"""Contrast checks for design tokens and code highlighting (A11Y-11 to A11Y-13, A11Y-71).

Usage: python scripts/check_contrast.py design/tokens.json
"""
import json
import sys
from pathlib import Path

from pygments.styles import get_style_by_name
from pygments.token import Text

TOKEN_PAIRS = [  # (foreground, background, minimum ratio)
    ("fg", "bg", 7.0), ("fg", "surface", 7.0),
    ("muted", "bg", 4.5), ("muted", "surface", 4.5),
    ("link", "bg", 4.5), ("link", "surface", 4.5),
    ("link-visited", "bg", 4.5), ("link-visited", "surface", 4.5),
    ("error", "bg", 4.5), ("error", "surface", 4.5),
    ("border", "bg", 3.0), ("border", "surface", 3.0),
    ("focus", "bg", 3.0), ("focus", "surface", 3.0),
]
CODE_STYLES = {"light": "xcode", "dark": "github-dark"}  # high-contrast theme uses no token colours


def _channel(value: int) -> float:
    c = value / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_colour: str) -> float:
    h = hex_colour.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _channel(r) + 0.7152 * _channel(g) + 0.0722 * _channel(b)


def contrast(a: str, b: str) -> float:
    high, low = sorted((luminance(a), luminance(b)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def check_tokens(themes: dict) -> list[str]:
    problems = []
    for theme, tokens in themes.items():
        for fg, bg, minimum in TOKEN_PAIRS:
            ratio = contrast(tokens[fg], tokens[bg])
            if ratio < minimum:
                problems.append(f"{theme}: {fg} on {bg} = {ratio:.2f}:1 (needs {minimum}:1)")
    return problems


def check_code_styles(themes: dict, minimum: float = 4.5) -> list[str]:
    problems = []
    for theme, style_name in CODE_STYLES.items():
        background = themes[theme]["surface"]
        for token, definition in get_style_by_name(style_name):
            colour = definition.get("color")
            if not colour or token in Text.Whitespace:
                continue
            bgcolor = definition.get("bgcolor")
            bg = "#" + bgcolor.lstrip("#") if bgcolor else background
            ratio = contrast("#" + colour.lstrip("#"), bg)
            if ratio < minimum:
                problems.append(f"{theme}/{style_name}: {token} = {ratio:.2f}:1 (needs {minimum}:1)")
    return problems


def main(path: str) -> int:
    themes = json.loads(Path(path).read_text(encoding="utf-8"))
    problems = check_tokens(themes) + check_code_styles(themes)
    for problem in problems:
        print(problem, file=sys.stderr)
    print(f"contrast: {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "design/tokens.json"))
```

### 4.3 Typography, resizing, reflow and spacing (#3)

| ID | Rule |
|---|---|
| A11Y-20 | MUST: sizes in `rem` or `em`, and no fixed heights on text containers. Content reflows at 320 CSS px (400% zoom) without horizontal page scrolling. Code blocks, tables and diagrams MAY scroll inside their own container. |
| A11Y-21 | MUST: layout survives the WCAG 1.4.12 text-spacing overrides (line height 1.5, paragraph spacing 2 × font size, letter spacing 0.12 em, word spacing 0.16 em). |
| A11Y-22 | SHOULD: body text 1.125 rem (18 px), line height 1.5, line length 60–80 characters (default 70 ch), left-aligned, never justified, no italics for long passages, and a sans-serif typeface with clearly distinct letterforms (I, l and 1; O and 0). |
| A11Y-23 | MUST NOT: block zoom (no `maximum-scale` and no `user-scalable=no` in the viewport meta tag). |
| A11Y-24 | MUST: fonts are self-hosted as WOFF2 with `font-display: swap`, subsetted, under a licence that permits self-hosting (for example SIL OFL). No Google Fonts CDN (also SEC-61 and the Privacy Act). |
| A11Y-25 | MUST NOT: text in images, except logos. |

```css
html { font-size: 100%; text-size-adjust: 100%; }
body {
  font-family: var(--font-body, system-ui, sans-serif);
  font-size: 1.125rem;
  line-height: var(--line-height, 1.5);
  letter-spacing: var(--letter-spacing, normal);
  word-spacing: var(--word-spacing, normal);
  color: var(--fg);
  background: var(--bg);
}
p, li, dd { max-inline-size: var(--measure, 70ch); margin-block: 0 var(--paragraph-spacing, 1em); text-align: start; }
h1, h2, h3 { line-height: 1.25; }
main { inline-size: min(100% - 2rem, 72rem); margin-inline: auto; }
a { color: var(--link); text-decoration: underline; text-underline-offset: 0.15em; }
a:visited { color: var(--link-visited); }
img, svg, video { max-inline-size: 100%; block-size: auto; }
.code-pre, .table-wrap { max-inline-size: 100%; overflow-x: auto; }
```

### 4.4 Keyboard, focus and voice control (#4, #15, #16)

| ID | Rule |
|---|---|
| A11Y-30 | MUST: everything works with the keyboard alone, in a logical order, with no keyboard traps. |
| A11Y-31 | MUST: focus is visible. `:focus-visible` gets an outline of at least 3 px with at least 3:1 contrast against adjacent colours. Never use `outline: none` without a replacement. |
| A11Y-32 | MUST: the focused element is never hidden behind a sticky header or banner (`scroll-padding-top`; WCAG 2.4.11). |
| A11Y-33 | MUST: dialogs and menus close with Esc. Focus moves into them when they open and returns to the opener when they close. |
| A11Y-34 | MUST: in `forced-colors: active` mode, focus indicators and button boundaries stay visible (use outlines and real borders, not just backgrounds). |
| A11Y-35 | MUST: every control's accessible name starts with its visible text (WCAG 2.5.3), and icon-only controls have an accessible name. This lets Voice Control, Voice Access and Dragon users say "click Projects". |

```css
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
html { scroll-padding-top: calc(var(--header-height, 4rem) + 1rem); }
.skip-link {
  position: absolute; inset-inline-start: 1rem; inset-block-start: -10rem; z-index: 100;
  padding: 0.75rem 1rem; color: var(--fg); background: var(--bg); border: 2px solid var(--focus);
}
.skip-link:focus { inset-block-start: 1rem; }
.visually-hidden {
  position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}
@media (forced-colors: active) {
  :focus-visible { outline-color: Highlight; }
  button, .button { border: 1px solid ButtonText; }
}
```

### 4.5 Motion (#11)

| ID | Rule |
|---|---|
| A11Y-40 | MUST NOT: autoplay, parallax, scroll-jacking or scroll-triggered animation. Nothing flashes more than three times per second. |
| A11Y-41 | MUST: non-essential animation runs only inside `@media (prefers-reduced-motion: no-preference)`, and never when the user has chosen "Reduce motion" in the display settings (`data-motion="reduce"`). |
| A11Y-42 | SHOULD: transitions last no more than 200 ms and change only opacity or colour. |

```css
@media (prefers-reduced-motion: no-preference) {
  html:not([data-motion="reduce"]) { scroll-behavior: smooth; }
  html:not([data-motion="reduce"]) .card { transition: box-shadow 150ms ease-out; }
}
html[data-motion="reduce"] *,
html[data-motion="reduce"] *::before,
html[data-motion="reduce"] *::after {
  animation: none !important;
  transition: none !important;
  scroll-behavior: auto !important;
}
```

### 4.6 Targets, touch and mobile (#12)

| ID | Rule |
|---|---|
| A11Y-45 | MUST: targets are at least 24 × 24 CSS px, with spacing (WCAG 2.5.8). SHOULD: 44 × 44 for the menu, display settings, copy buttons and social icons (`.icon-button { min-inline-size: 2.75rem; min-block-size: 2.75rem; }`). |
| A11Y-46 | MUST: the site works in portrait and landscape. Nothing requires path-based gestures or dragging (WCAG 2.5.1 and 2.5.7). |

### 4.7 Themes and system preferences (#13)

| ID | Rule |
|---|---|
| A11Y-50 | MUST: the light theme is the default. A dark theme applies automatically through `prefers-color-scheme`. A manual choice in the display settings overrides both and is saved in `localStorage` (no cookies). |
| A11Y-51 | MUST: every theme passes A11Y-11 (checked in CI). |
| A11Y-52 | SHOULD: `prefers-contrast: more` makes borders and secondary text full strength. |
| A11Y-53 | MUST: test with `forced-colors: active`. Icons use `currentColor`, buttons have borders, and no information depends on background images. |
| A11Y-54 | MUST: diagrams are readable in every theme. In the dark theme they sit on a light card with a border. Never use a transparent PNG or SVG that disappears against a dark background. |

```css
:root {
  color-scheme: light;
  --bg: #ffffff; --surface: #f4f6f8; --fg: #1b1f24; --muted: #4b5563;
  --link: #0a50c2; --link-visited: #6b21a8; --focus: #0a50c2; --border: #6b7280; --error: #b3261e;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: dark;
    --bg: #0f1419; --surface: #1a2028; --fg: #e8eaed; --muted: #b8bec6;
    --link: #8ab4f8; --link-visited: #d7aefb; --focus: #8ab4f8; --border: #8b949e; --error: #f2b8b5;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f1419; --surface: #1a2028; --fg: #e8eaed; --muted: #b8bec6;
  --link: #8ab4f8; --link-visited: #d7aefb; --focus: #8ab4f8; --border: #8b949e; --error: #f2b8b5;
}
:root[data-theme="high-contrast"] {
  color-scheme: dark;
  --bg: #000000; --surface: #000000; --fg: #ffffff; --muted: #ffffff;
  --link: #ffff00; --link-visited: #ff99ff; --focus: #ffff00; --border: #ffffff; --error: #ff9999;
}
@media (prefers-contrast: more) {
  :root:not([data-theme="high-contrast"]) { --muted: var(--fg); --border: var(--fg); }
}
```

SHOULD: generate this CSS from `design/tokens.json` at build time, so the colours have a single source.

### 4.8 Images and technical diagrams (#6, #25)

| ID | Rule |
|---|---|
| A11Y-60 | MUST: every `img` has an `alt`. Decorative images get `alt=""`. Informative images get a short statement of their purpose, about 150 characters at most. Complex images get a short `alt` plus a long description in the HTML next to them. |
| A11Y-61 | MUST: complex diagrams have a text equivalent inside `figure` > `details` that describes the components, relationships and flows, with a table wherever the data is tabular. |
| A11Y-62 | MUST: Mermaid sources include `accTitle` and `accDescr`, and are pre-rendered to SVG at build time. The HTML text equivalent is still required, because screen readers walk Mermaid SVG nodes in DOM order without conveying the structure (mermaid-js issue #5632). |
| A11Y-63 | MUST: terminal output and configuration are published as text. A screenshot is allowed only alongside the text. |
| A11Y-64 | MUST: the Supabase `media` table enforces `alt_text`, `long_description` and `review_status` (SQL in §5.2), and the build fails if anything is missing (script below). |
| A11Y-65 | MUST: every homelab description, image and text alternative passes SEC-40 to SEC-45 (no real addresses, hostnames or versions). |

```html
<figure class="diagram" aria-labelledby="fig-homelab-caption">
  <img src="/media/homelab-architecture.svg" width="960" height="540"
       alt="Homelab architecture: three cluster nodes with shared storage and a reverse proxy. Full description follows.">
  <figcaption id="fig-homelab-caption">Figure 1. Homelab architecture overview.</figcaption>
  <details>
    <summary>Text description of figure 1</summary>
    <p>Three nodes form one virtualisation cluster. All three use the same shared storage, so virtual machines can move between nodes. A reverse proxy on node 1 publishes selected services through an outbound tunnel; nothing is exposed directly to the internet.</p>
    <table>
      <caption>Components in figure 1</caption>
      <thead><tr><th scope="col">Component</th><th scope="col">Role</th><th scope="col">Connected to</th></tr></thead>
      <tbody>
        <tr><th scope="row">Node 1</th><td>Compute, reverse proxy</td><td>Shared storage, tunnel</td></tr>
        <tr><th scope="row">Node 2</th><td>Compute</td><td>Shared storage</td></tr>
        <tr><th scope="row">Node 3</th><td>Compute, backups</td><td>Shared storage</td></tr>
      </tbody>
    </table>
  </details>
</figure>
```

Mermaid source (`diagrams/homelab-architecture.mmd`), rendered at build with `npx mmdc -i diagrams/homelab-architecture.mmd -o _site/media/homelab-architecture.svg -t neutral -b white`:

```text
flowchart LR
  accTitle: Homelab architecture overview
  accDescr: Three cluster nodes share storage. A reverse proxy on node 1 publishes selected services through an outbound tunnel.
  n1[Node 1: compute and reverse proxy] --- st[(Shared storage)]
  n2[Node 2: compute] --- st
  n3[Node 3: compute and backups] --- st
  n1 --> t([Outbound tunnel])
```

Media check, run during the build after fetching rows from Supabase (`site_builder/media.py`):

```python
"""Build-time checks for media rows (A11Y-60 to A11Y-64). Any problem fails the build."""
COMPLEX_KINDS = {"diagram", "screenshot", "chart"}


def check_media(rows: list[dict]) -> list[str]:
    problems = []
    for row in rows:
        ref = row["path"]
        if row["review_status"] != "approved":
            problems.append(f"{ref}: not approved (status: {row['review_status']})")
            continue
        if row["decorative"]:
            continue
        alt = (row.get("alt_text") or "").strip()
        if not alt:
            problems.append(f"{ref}: missing alt text")
        elif len(alt) > 250:
            problems.append(f"{ref}: alt text over 250 characters; move detail to long_description")
        if row["kind"] in COMPLEX_KINDS and not (row.get("long_description") or "").strip():
            problems.append(f"{ref}: {row['kind']} needs a long_description")
    return problems
```

### 4.9 Code blocks (#17)

| ID | Rule |
|---|---|
| A11Y-70 | MUST: code is real text in `pre` > `code class="language-…"`, never an image of code. |
| A11Y-71 | MUST: every syntax-highlighting colour is at least 4.5:1 against the code background in each theme. Verified with Pygments 2.21: `xcode` on `#f4f6f8` (lowest 4.68:1) for light, `github-dark` on `#1a2028` (lowest 4.78:1) for dark, no token colours in high contrast. CI re-checks, because styles change between versions. |
| A11Y-72 | MUST: when a block overflows, its scroll container gets `tabindex="0"`, `role="region"` and a label, but only while it overflows (axe rule `scrollable-region-focusable`; Safari does not make scroll regions focusable by itself). |
| A11Y-73 | MUST: the copy button is a native `button` named "Copy code" plus context. It confirms through the shared `role="status"` region and copies exactly the visible code: no hidden content, no prompts. |
| A11Y-74 | MUST NOT: put shell prompts (`$`, `#`) inside copyable commands. Output goes in a separate block captioned "Output". |
| A11Y-75 | SHOULD: summarise long output in prose ("The command lists three nodes, all online."). |

Authors write fenced code with an optional title: `` ```bash title="List the cluster nodes" ``. The renderer in §5.1 turns this into a `figure` with a `figcaption`. `site.js` then adds the scroll handling and the copy button:

```js
// site.js (part): code blocks — A11Y-72, A11Y-73, SEC-80, SEC-84
function announce(message) {
  const region = document.getElementById("sr-status");
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => { region.textContent = message; }, 50);
}

function enhanceCodeBlocks() {
  document.querySelectorAll("figure.code-block").forEach((figure, index) => {
    const pre = figure.querySelector("pre");
    const code = figure.querySelector("code");
    const caption = figure.querySelector("figcaption");
    if (!pre || !code) return;
    const label = caption ? caption.textContent.trim() : `Code example ${index + 1}`;
    if (caption) caption.id = `code-caption-${index + 1}`;

    const updateScrollable = () => {
      if (pre.scrollWidth > pre.clientWidth) {
        pre.tabIndex = 0;
        pre.setAttribute("role", "region");
        if (caption) pre.setAttribute("aria-labelledby", caption.id);
        else pre.setAttribute("aria-label", label);
      } else {
        for (const attribute of ["tabindex", "role", "aria-labelledby", "aria-label"]) {
          pre.removeAttribute(attribute);
        }
      }
    };
    updateScrollable();
    new ResizeObserver(updateScrollable).observe(pre);

    if (!navigator.clipboard) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button icon-button";
    button.textContent = "Copy code";
    const context = document.createElement("span");
    context.className = "visually-hidden";
    context.textContent = `: ${label}`;
    button.append(context);
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        announce("Code copied to the clipboard.");
      } catch {
        announce("Copying failed. Select the code and copy it manually.");
      }
    });
    figure.append(button);
  });
}
```

### 4.10 Contact form (#5)

| ID | Rule |
|---|---|
| A11Y-80 | MUST: each field has a visible `label`; hints come before the field; `autocomplete` tokens are set (`name`, `email`); spellcheck is off for email. |
| A11Y-81 | MUST: errors are shown as text for each field, linked with `aria-describedby` and marked `aria-invalid`. An error summary at the top receives focus and links to each field (the GOV.UK pattern). |
| A11Y-82 | MUST: success is announced in a `role="status"` region. |
| A11Y-83 | MUST NOT: time limits or cognitive tests (WCAG 3.3.8). MUST NOT clear what the person typed after an error or a security re-check (WCAG 3.3.7). |
| A11Y-84 | MUST: the contact page shows the email alternative (D2) and the expected reply time (D7). |
| A11Y-85 | MUST: the honeypot field is hidden from everyone: positioned off-screen, with `aria-hidden="true"`, `tabindex="-1"` and `autocomplete="off"`, a name that does not match any autofill token, and the label "Leave this field empty". |

```html
<p id="contact-notice">{{ collection_notice }}</p>  <!-- PRIV-02, §6.4 -->

<div id="error-summary" class="error-summary" tabindex="-1" aria-labelledby="error-summary-title" hidden>
  <h2 id="error-summary-title">There is a problem</h2>
  <ul></ul>
</div>

<form id="contact-form" action="/api/contact" method="post" novalidate
      data-sitekey="{{ turnstile_site_key }}"
      data-unavailable-message="The contact form is not working right now. Your message has not been sent. Please email {{ contact_email }} instead.">
  <div class="field">
    <label for="name">Your name</label>
    <p class="field-error" id="name-error" hidden></p>
    <input id="name" name="name" type="text" autocomplete="name" maxlength="100" required aria-describedby="name-error">
  </div>
  <div class="field">
    <label for="email">Your email address</label>
    <p class="hint" id="email-hint">I will only use this to reply to you.</p>
    <p class="field-error" id="email-error" hidden></p>
    <input id="email" name="email" type="email" autocomplete="email" spellcheck="false" maxlength="254" required
           aria-describedby="email-hint email-error">
  </div>
  <div class="field">
    <label for="message">Your message</label>
    <p class="field-error" id="message-error" hidden></p>
    <textarea id="message" name="message" rows="8" maxlength="5000" required aria-describedby="message-error"></textarea>
  </div>

  <div class="hp" aria-hidden="true">
    <label for="reference_code">Leave this field empty</label>
    <input id="reference_code" name="reference_code" type="text" tabindex="-1" autocomplete="off">
  </div>
  <input type="hidden" name="started_at" value="">
  <div id="turnstile"></div>

  <button type="submit">Send message</button>
  <p id="form-status" role="status"></p>
</form>

<noscript>
  <p>This form needs JavaScript for spam protection. Please email me at
  <a href="mailto:{{ contact_email }}">{{ contact_email }}</a>.</p>
</noscript>
<p>Prefer email? Write to <a href="mailto:{{ contact_email }}">{{ contact_email }}</a>. {{ reply_time }}</p>
<script src="/assets/js/contact.js" defer></script>
```

```css
.hp { position: absolute; inset-inline-start: -10000px; inline-size: 1px; block-size: 1px; overflow: hidden; }
.field-error { color: var(--error); font-weight: 600; }
[aria-invalid="true"] { border: 2px solid var(--error); }
.error-summary { border: 3px solid var(--error); padding: 1rem; }
```

`assets/js/contact.js` is loaded only on `/contact/` (SEC-32). It injects the Turnstile script itself, so the callback always exists before the script runs:

```js
// contact.js — A11Y-80 to A11Y-85, SEC-24, SEC-80, SEC-81
(() => {
  "use strict";
  const form = document.getElementById("contact-form");
  if (!form) return;
  const summary = document.getElementById("error-summary");
  const summaryList = summary.querySelector("ul");
  const status = document.getElementById("form-status");
  const submit = form.querySelector('button[type="submit"]');
  const FIELDS = new Set(["name", "email", "message", "form"]);
  const unavailable = form.dataset.unavailableMessage;
  form.elements.namedItem("started_at").value = String(Date.now());

  let widgetId = null;
  let waiting = null;
  let busy = false;

  const settle = (token) => {
    if (waiting) {
      waiting(token);
      waiting = null;
    }
  };

  window.onTurnstileLoad = () => {
    widgetId = window.turnstile.render("#turnstile", {
      sitekey: form.dataset.sitekey,
      action: "contact",
      execution: "execute",            // token created at submit time (SEC-24)
      appearance: "interaction-only",  // visible only if a person must interact
      callback: (token) => settle(token),
      "error-callback": () => settle(""),
      "timeout-callback": () => settle(""),
    });
  };
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
  script.async = true;
  document.head.append(script);

  const freshToken = () => new Promise((resolve) => {
    if (widgetId === null || !window.turnstile) {
      resolve("");
      return;
    }
    waiting = resolve;
    window.turnstile.reset(widgetId);
    window.turnstile.execute(widgetId);
  });

  const clearErrors = () => {
    summary.hidden = true;
    summaryList.replaceChildren();
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    form.querySelectorAll(".field-error").forEach((el) => {
      el.textContent = "";
      el.hidden = true;
    });
  };

  const showErrors = (errors) => {
    for (const [name, text] of Object.entries(errors)) {
      if (!FIELDS.has(name)) continue;
      const item = document.createElement("li");
      const field = name === "form" ? null : form.elements.namedItem(name);
      if (field instanceof HTMLElement) {
        const link = document.createElement("a");
        link.href = `#${field.id}`;
        link.textContent = String(text);
        link.addEventListener("click", (event) => {
          event.preventDefault();
          field.focus();
        });
        item.append(link);
        field.setAttribute("aria-invalid", "true");
        const inline = document.getElementById(`${field.id}-error`);
        if (inline) {
          inline.textContent = String(text);
          inline.hidden = false;
        }
      } else {
        item.textContent = String(text);
      }
      summaryList.append(item);
    }
    summary.hidden = false;
    summary.focus();
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    submit.setAttribute("aria-disabled", "true");
    clearErrors();
    status.textContent = "Sending your message…";

    let result;
    try {
      const data = new FormData(form);
      data.set("cf-turnstile-response", await freshToken());
      const response = await fetch(form.action, {
        method: "POST",
        body: data,
        headers: { accept: "application/json" },
      });
      result = await response.json();
    } catch {
      result = { ok: false, errors: { form: unavailable } };
    }

    busy = false;
    submit.removeAttribute("aria-disabled");
    if (result && result.ok) {
      form.reset();
      form.elements.namedItem("started_at").value = String(Date.now());
      status.textContent = "Thank you. Your message has been sent.";
      return;
    }
    status.textContent = "";
    // The typed text stays in the form (A11Y-83).
    showErrors((result && result.errors) || { form: unavailable });
  });
})();
```

### 4.11 Plain language and content (#9, #24)

| ID | Rule |
|---|---|
| A11Y-90 | MUST: each key page opens with a summary of one or two sentences. Technical posts start with a "TL;DR". |
| A11Y-91 | MUST: expand abbreviations in text the first time they appear ("Proxmox VE, a virtualisation platform"). `<abbr title>` alone is not enough. |
| A11Y-92 | SHOULD: CI warns, without blocking, when a page's reading level is high (`textstat`). |
| A11Y-93 | SHOULD (phase 3, D6): publish an Easy Read version of the About page, linked from its top: short sentences, one idea per line, supporting images with alt text. Use AI only for a draft; a person reviews it, ideally tested with a reader from the target group. |
| A11Y-94 | SHOULD: keep a glossary page for homelab and Business Analysis terms, linked from posts. |

### 4.12 Documents: CV (#14)

| ID | Rule |
|---|---|
| A11Y-100 | MUST: the HTML Experience page is the primary CV. The PDF is an alternative. |
| A11Y-101 | MUST: the PDF is tagged (PDF/UA), with a title, language, logical reading order and headings, validated with PAC or veraPDF. The link states format and size: "Download CV (PDF, 180 KB)". |
| A11Y-102 | MUST: the PDF is generated from the same HTML at build time (WeasyPrint, SEC-07), so the two never drift apart. |

### 4.13 Audio and video (#10, #28): conditional

| ID | Rule |
|---|---|
| A11Y-110 | MUST, if video is ever published: human-reviewed captions (`.vtt` via `<track>`), an HTML transcript, and audio description or an equivalent text for information shown only visually (for example terminal demos). No autoplay; the player works with the keyboard. |
| A11Y-111 | SHOULD: self-host the video. If an embed is unavoidable, use `youtube-nocookie.com` behind a click-to-load facade, and update the third-party register and CSP first (SEC-60, SEC-62). |

### 4.14 LinkedIn and GitHub content (#23)

| ID | Rule |
|---|---|
| A11Y-120 | MUST: LinkedIn posts and GitHub repositories are rendered at build time as the site's own semantic HTML, never as iframes or widgets. Link text is specific: "View on LinkedIn: {post title}". |
| A11Y-121 | MUST: add alt text to images in LinkedIn posts too (LinkedIn supports it). The same reviewed text comes from Supabase. |

### 4.15 Performance, accessibility statement and feedback (#19, #21)

| ID | Rule |
|---|---|
| A11Y-125 | SHOULD: the home page weighs under about 500 KB in total and works on a 3G connection and older phones. |
| A11Y-126 | MUST: images are AVIF or WebP with `width` and `height` set (no layout shift); fonts are subsetted; JavaScript is minimal and non-blocking (except `prefs-early.js`). |
| A11Y-127 | SHOULD: run Lighthouse CI to monitor performance, as information rather than a gate. |
| A11Y-130 | MUST: publish `/accessibility/` (template in §9), linked from every footer, with the target, the date of the last test, the technologies tested and known issues. It must be accurate (LAW-02). |
| A11Y-131 | MUST: the statement gives a way to report barriers and a response target. Reported barriers are triaged as defects (LAW-03). |

### 4.16 Display settings panel (#22): evidence-based innovation

The panel puts in one place adjustments that the evidence supports: text size (Rello et al.), spacing (Zorzi et al.), theme and polarity (Piepenbrock et al.; WebAIM Low Vision Survey) and reduced motion (WCAG 2.3.3). It does not replace the platform. Most people with low vision rely on their own browser and OS tools, which is why the base site (phases 1 and 2) must already work with them.

| ID | Rule |
|---|---|
| INNOV-01 | MUST: settings only change CSS, through `data-*` attributes on `<html>`. They never change ARIA, content or the DOM order. |
| INNOV-02 | MUST: settings live only in `localStorage` under `a11y-prefs`, using allow-listed values. They are never sent anywhere, logged, or used as analytics events (P4, PRIV-10). |
| INNOV-03 | MUST: use a native `<dialog>` opened with `showModal()`, labelled by its heading, with radio groups in `fieldset`/`legend`. Esc closes it, and focus returns to the opener. |
| INNOV-04 | MUST: include a "Reset to my device settings" button. |
| INNOV-05 | MUST: the opener stays `hidden` until JavaScript runs. The site is fully accessible if the panel is never opened (GOV-07). |
| INNOV-06 | MAY: offer an "Alternative font (personal preference)" option. It MUST NOT claim to improve reading for dyslexia, and the default stays the standard sans-serif (§3 #31). |
| INNOV-07 | MAY: offer a reading ruler, off by default and only inside the panel (limited evidence). |
| INNOV-08 | MAY (conditional, #27): a "Listen" button on posts using `speechSynthesis`. It is a normal button and never starts by itself. MUST NOT use speech recognition or the microphone. Prefer A11Y-09, which makes the browser's own read-aloud work. |

`assets/js/prefs-early.js` (synchronous, in `<head>`, ES5 so it runs everywhere):

```js
// Runs before first paint. Applies saved display settings. No network, no logging (INNOV-01, INNOV-02).
(function () {
  "use strict";
  var ALLOWED = {
    theme: ["system", "light", "dark", "high-contrast"],
    text: ["100", "125", "150", "175", "200"],
    spacing: ["normal", "wide"],
    measure: ["standard", "narrow"],
    motion: ["system", "reduce"]
  };
  var prefs = {};
  try {
    prefs = JSON.parse(window.localStorage.getItem("a11y-prefs") || "{}") || {};
  } catch (e) {
    prefs = {};
  }
  var root = document.documentElement;
  Object.keys(ALLOWED).forEach(function (key) {
    if (ALLOWED[key].indexOf(prefs[key]) > 0) {  // index 0 is the default: no attribute
      root.setAttribute("data-" + key, prefs[key]);
    }
  });
})();
```

`templates/display-settings.html`:

```html
<dialog id="display-settings" aria-labelledby="display-settings-title">
  <form method="dialog" class="settings-form">
    <h2 id="display-settings-title">Display settings</h2>
    <p>These settings change how this site looks on this device only. They are saved in your browser and never sent to me.</p>

    <fieldset>
      <legend>Colour theme</legend>
      <label><input type="radio" name="theme" value="system"> Match my device</label>
      <label><input type="radio" name="theme" value="light"> Light</label>
      <label><input type="radio" name="theme" value="dark"> Dark</label>
      <label><input type="radio" name="theme" value="high-contrast"> High contrast</label>
    </fieldset>
    <fieldset>
      <legend>Text size</legend>
      <label><input type="radio" name="text" value="100"> 100%</label>
      <label><input type="radio" name="text" value="125"> 125%</label>
      <label><input type="radio" name="text" value="150"> 150%</label>
      <label><input type="radio" name="text" value="175"> 175%</label>
      <label><input type="radio" name="text" value="200"> 200%</label>
    </fieldset>
    <fieldset>
      <legend>Text spacing</legend>
      <label><input type="radio" name="spacing" value="normal"> Normal</label>
      <label><input type="radio" name="spacing" value="wide"> Wide</label>
    </fieldset>
    <fieldset>
      <legend>Line length</legend>
      <label><input type="radio" name="measure" value="standard"> Standard</label>
      <label><input type="radio" name="measure" value="narrow"> Narrow</label>
    </fieldset>
    <fieldset>
      <legend>Motion</legend>
      <label><input type="radio" name="motion" value="system"> Match my device</label>
      <label><input type="radio" name="motion" value="reduce"> Reduce motion</label>
    </fieldset>

    <div class="settings-actions">
      <button type="button" data-reset>Reset to my device settings</button>
      <button value="close">Close</button>
    </div>
  </form>
</dialog>
```

```js
// site.js (part): display settings — INNOV-01 to INNOV-05, SEC-80 to SEC-82
function initDisplaySettings() {
  const KEY = "a11y-prefs";
  const ALLOWED = {
    theme: ["system", "light", "dark", "high-contrast"],
    text: ["100", "125", "150", "175", "200"],
    spacing: ["normal", "wide"],
    measure: ["standard", "narrow"],
    motion: ["system", "reduce"],
  };
  const dialog = document.getElementById("display-settings");
  const opener = document.getElementById("display-settings-open");
  if (!dialog || !opener || typeof dialog.showModal !== "function") return;
  const root = document.documentElement;

  const read = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  };
  let state = read();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage blocked: the settings still apply until the page is closed.
    }
  };
  const apply = () => {
    for (const [key, values] of Object.entries(ALLOWED)) {
      if (values.indexOf(state[key]) > 0) root.setAttribute(`data-${key}`, state[key]);
      else root.removeAttribute(`data-${key}`);
    }
  };
  const sync = () => {
    for (const [key, values] of Object.entries(ALLOWED)) {
      const current = values.includes(state[key]) ? state[key] : values[0];
      const input = dialog.querySelector(`input[name="${key}"][value="${current}"]`);
      if (input) input.checked = true;
    }
  };

  opener.hidden = false;
  opener.addEventListener("click", () => {
    sync();
    dialog.showModal();
  });
  dialog.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const values = ALLOWED[input.name];
    if (!values || !values.includes(input.value)) return;
    state = { ...state, [input.name]: input.value };
    save();
    apply();
  });
  dialog.querySelector("[data-reset]").addEventListener("click", () => {
    state = {};
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Ignore: nothing stored.
    }
    apply();
    sync();
  });
  dialog.addEventListener("close", () => opener.focus());
}

document.addEventListener("DOMContentLoaded", () => {
  initDisplaySettings();
  enhanceCodeBlocks();
});
```

```css
html[data-text="125"] { font-size: 125%; }
html[data-text="150"] { font-size: 150%; }
html[data-text="175"] { font-size: 175%; }
html[data-text="200"] { font-size: 200%; }
html[data-spacing="wide"] {
  --line-height: 1.8;
  --letter-spacing: 0.12em;
  --word-spacing: 0.16em;
  --paragraph-spacing: 2em;
}
html[data-measure="narrow"] { --measure: 55ch; }
.settings-form fieldset { border: 1px solid var(--border); margin-block-end: 1rem; }
.settings-form label { display: flex; align-items: center; gap: 0.5rem; min-block-size: 2.75rem; }
dialog { color: var(--fg); background: var(--bg); border: 2px solid var(--border); max-inline-size: min(40rem, 100% - 2rem); }
dialog::backdrop { background: rgb(0 0 0 / 0.6); }
```

### 4.17 AI-drafted image descriptions (#25)

| ID | Rule |
|---|---|
| INNOV-10 | MUST: AI drafts are saved with `review_status = 'needs_review'`, and the build blocks anything that is not `approved` (A11Y-64). |
| INNOV-11 | MUST: a person reviews every draft against the actual image, checking labels, numbers, relationships and anything the model may have invented (OWASP LLM09: misinformation). |
| INNOV-12 | MUST NOT: send images that contain secrets, addresses or hostnames to an AI API. Redact first (SEC-40). |
| INNOV-13 | MUST: the API key lives only in a local environment variable or a CI secret, never in client code. The script runs on demand for new images, not on every build, to cap cost (OWASP LLM10: unbounded consumption). |
| INNOV-14 | MUST NOT: generate image descriptions in the visitor's browser or at request time. |

### 4.18 Te reo Māori and NZSL (#26, #28)

| ID | Rule |
|---|---|
| INNOV-20 | SHOULD: open with a bilingual greeting, `<p><span lang="mi">Kia ora</span>, I'm Carlos.</p>`, with correct macrons everywhere. In Markdown, write `[Kia ora]{lang=mi}` (§5.1). |
| INNOV-21 | MAY (D6): add a short NZSL video introduction made with an accredited interpreter, captioned, and updated whenever the content it covers changes (A11Y-110). |

### 4.19 Do not build

| Feature | Why not |
|---|---|
| Accessibility overlays and widgets | Blind and low-vision users report they make problems worse (ASSETS 2024). The FTC fined accessiBe in 2025. They inject third-party JavaScript with full page access (OWASP A03/A08) and can collect assistive-technology data (Overlay Fact Sheet). See SEC-63. |
| Visual or puzzle CAPTCHA | It is a cognitive test without an equivalent alternative (WCAG 3.3.8), a barrier for blind, low-vision, motor and cognitive disabilities, and a third-party tracking script. |
| Dyslexia fonts as the default | Controlled studies show no benefit (Rello & Baeza-Yates 2016; Wery & Diliberto 2017; Kuster et al. 2018). Size and spacing help; see §4.3. |
| Custom voice navigation | It duplicates and can conflict with Voice Control, Voice Access and Dragon, which already work when A11Y-35 is met. In some browsers, Chrome among them, speech recognition sends audio to a server. |
| AI chatbot | Users already bring their own AI. It adds prompt injection, sensitive-information and system-prompt leakage, misinformation about your career, and cost attacks (OWASP LLM01, LLM02, LLM07, LLM09, LLM10). Chat widgets often break focus management and announcements. A well-structured FAQ page is the accessible, verifiable alternative. |
| Assistive-technology detection | It breaches P3 and the W3C TAG design principle that sites should not be able to detect assistive technology. Information about disability is sensitive. |
| Sonification and haptics | Promising only for data charts, which the site does not have. Text and tables work better for architecture diagrams. |
| Public comments or other user-generated content | Moderation burden, the Harmful Digital Communications Act 2015, stored XSS risk. |

---

## 5. Security rules (OWASP Top 10:2025)

| OWASP Top 10:2025 category | Where it applies on carlos.nz | Rules |
|---|---|---|
| A01 Broken Access Control (now includes SSRF) | Supabase RLS; homelab information disclosure (CWE-200); WeasyPrint resource loading | SEC-07, SEC-10 to 15, SEC-40 to 47 |
| A02 Security Misconfiguration | HTTP headers, CSP, Supabase keys, Cloudflare settings | SEC-12, SEC-50 to 56 |
| A03 Software Supply Chain Failures | GitHub Actions, pip and npm, third-party scripts | SEC-60 to 63, SEC-70 to 79 |
| A04 Cryptographic Failures | HTTPS everywhere, HSTS | SEC-54 |
| A05 Injection | Markdown/HTML rendering, form input, email headers, DOM updates | SEC-01 to 06, SEC-21, SEC-29, SEC-80 to 84 |
| A06 Insecure Design | Anti-spam design, rate limiting, minimal data | SEC-25 to 27 |
| A07 Authentication Failures | Accounts: GitHub, Supabase, Cloudflare, LinkedIn | SEC-15 |
| A08 Software or Data Integrity Failures | CI artefacts, pinned dependencies, no CDN scripts | SEC-61, SEC-70 to 76 |
| A09 Security Logging & Alerting Failures | Worker and Supabase logs, alerts | SEC-30, SEC-90 to 94 |
| A10 Mishandling of Exceptional Conditions | Fail closed with an accessible message | SEC-23, SEC-31, SEC-90 |

### 5.1 Content pipeline (A05, A01)

| ID | Rule |
|---|---|
| SEC-01 | MUST: Jinja2 uses `autoescape=select_autoescape(["html", "xml"])`. Nothing is marked safe except the `Markup` returned by `render_markdown()`. |
| SEC-02 | MUST: Markdown is rendered with raw HTML disabled, and the output is sanitised with the `nh3` allow-list below. Only the `https` and `mailto` URL schemes are allowed. |
| SEC-03 | MUST: every value placed in an attribute (alt, title, captions) goes through autoescaping. No string concatenation in templates. |
| SEC-04 | MUST: data from the GitHub and LinkedIn APIs is untrusted text. It is escaped, never rendered as HTML, and limited to your own repositories and posts. |
| SEC-05 | MUST: any sanitisation or validation problem fails the build. Nothing is published silently. |
| SEC-06 | MUST NOT: inline SVG from content. Diagrams are served as `<img src="….svg">`, because scripts inside SVG used as an image never run. Mermaid is pre-rendered at build time with mermaid at least 11.15.0 (or the 10.9.6 line), which fixes CVE-2026-41148. |
| SEC-07 | MUST: WeasyPrint is version 70.0 or later (CVE-2026-55073, a URL-fetcher bypass) and loads only files from the build output directory, through a restrictive URL fetcher (the API differs between versions; check the docs for the installed one). Never pass content-derived URLs to `stylesheets` or `xmp_metadata`. |

`site_builder/render.py` was tested against `<script>`, `<img onerror>`, `javascript:` and `data:` links, `h1` injection and caption injection:

```python
"""Markdown from Supabase -> sanitised, highlighted HTML (SEC-01 to SEC-06, A11Y-70 to A11Y-74)."""
import re
from html import escape

import nh3
from markdown_it import MarkdownIt
from markupsafe import Markup
from mdit_py_plugins.attrs import attrs_plugin
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import get_lexer_by_name
from pygments.lexers.special import TextLexer
from pygments.util import ClassNotFound

_FORMATTER = HtmlFormatter(nowrap=True)
_TITLE = re.compile(r'title="([^"]{1,120})"')
_LANG = re.compile(r"^[A-Za-z0-9_+-]{1,30}$")


def _render_fence(self, tokens, idx, options, env):
    """Fenced code with an optional title, e.g. bash title="List the cluster nodes"."""
    info = tokens[idx].info.strip()
    lang, _, rest = info.partition(" ")
    if not _LANG.match(lang):
        lang = "text"
    try:
        lexer = get_lexer_by_name(lang)
    except ClassNotFound:
        lexer, lang = TextLexer(), "text"
    title = _TITLE.search(rest)
    caption = f"<figcaption>{escape(title.group(1))}</figcaption>" if title else ""
    body = highlight(tokens[idx].content, lexer, _FORMATTER)
    return (
        f'<figure class="code-block">{caption}'
        f'<pre class="code-pre"><code class="code language-{lang}">{body}</code></pre>'
        f"</figure>\n"
    )


_MD = (
    MarkdownIt("commonmark", {"html": False})  # raw HTML in Markdown is never rendered
    .enable("table")
    .enable("strikethrough")
    .use(attrs_plugin, spans=True)  # [kia ora]{lang=mi}
)
_MD.add_render_rule("fence", _render_fence)

ALLOWED_TAGS = {
    "a", "abbr", "blockquote", "br", "code", "del", "em", "figcaption", "figure",
    "h2", "h3", "h4", "hr", "li", "ol", "p", "pre", "span", "strong", "table",
    "tbody", "td", "th", "thead", "tr", "ul",
}
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title"},
    "abbr": {"title"},
    "code": {"class"},
    "figure": {"class"},
    "p": {"lang"},
    "pre": {"class"},
    "span": {"class", "lang"},
    "th": {"scope"},
}


def render_markdown(source: str) -> Markup:
    """The only function whose output templates may treat as safe (SEC-01)."""
    clean = nh3.clean(
        _MD.render(source),
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes={"https", "mailto"},
        link_rel="noopener noreferrer",
    )
    return Markup(clean)


def pygments_css(light: str = "xcode", dark: str = "github-dark") -> str:
    """Token colours per theme. Backgrounds come from the design tokens (A11Y-71)."""
    def scoped(style: str, scope: str) -> str:
        css = HtmlFormatter(style=style).get_style_defs(scope)
        return "\n".join(line for line in css.splitlines() if line.startswith(scope + " ."))

    return "\n".join([
        scoped(light, ".code"),
        scoped(dark, 'html[data-theme="dark"] .code'),
        "@media (prefers-color-scheme: dark) {",
        scoped(dark, "html:not([data-theme]) .code"),
        "}",
        'html[data-theme="high-contrast"] .code * { color: inherit; background: none; }',
    ])
```

### 5.2 Supabase (A01, A02, A07)

| ID | Rule |
|---|---|
| SEC-10 | MUST: the published site never talks to Supabase from the browser. Content is fetched only at build time, with a secret key stored as a GitHub Actions secret. If any page reads Supabase in the browser today (D5), move that read to the build first, then remove the key from the front end. |
| SEC-11 | MUST: RLS is enabled on every table in exposed schemas, with no policies for `anon` or `authenticated` unless this guide requires one, and table privileges revoked from both roles. Supabase grants `anon` broad privileges on new `public` tables by default, and tables created with SQL do not get RLS automatically. |
| SEC-12 | MUST: use the new secret keys (`sb_secret_…`). The legacy `anon` and `service_role` keys are being deprecated by the end of 2026. Use a separate secret key per consumer (build, Worker), so one leak forces only one rotation. Keys are never in client code or the repository; rotate on any suspicion. Send secret keys only in the `apikey` header. |
| SEC-13 | MUST: run the Supabase Security Advisor after every schema change, and leave zero RLS findings. |
| SEC-14 | MUST: database constraints enforce the accessibility fields (`media`) and the data minimisation (`contact_messages`) below. |
| SEC-15 | MUST: Supabase, GitHub, Cloudflare and LinkedIn accounts use MFA, preferably a passkey or security key, and recovery codes are stored offline. |

`supabase/migrations/<timestamp>_accessibility_security.sql`:

```sql
-- Media with enforced accessibility fields (A11Y-64, SEC-14).
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  kind text not null check (kind in ('photo', 'diagram', 'screenshot', 'chart', 'icon')),
  decorative boolean not null default false,
  alt_text text not null default '',
  long_description text,
  lang text not null default 'en-NZ',
  review_status text not null default 'draft'
    check (review_status in ('draft', 'needs_review', 'approved')),
  reviewed_at timestamptz,
  constraint approved_media_is_described check (
    review_status <> 'approved'
    or decorative
    or (
      char_length(btrim(alt_text)) between 1 and 250
      and (
        kind not in ('diagram', 'screenshot', 'chart')
        or char_length(btrim(coalesce(long_description, ''))) > 0
      )
    )
  )
);

alter table public.media enable row level security;
revoke all on table public.media from anon, authenticated;

-- Contact messages: only what is needed to reply (SEC-27, PRIV-01). No IP address, no user agent.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 1 and 5000),
  notice_version text not null
);

alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from anon, authenticated;
-- No policies on purpose: only secret keys (the service_role role) can read or write these tables.
```

### 5.3 Contact endpoint (A01, A02, A05, A06, A09, A10)

The endpoint is the only part of the site that accepts input from outside. It is the part where accessibility and security have to be designed together (GOV-05):

- the security check runs at submit time;
- the person never loses their text;
- every failure is explained in plain words, with an alternative.

| ID | Rule |
|---|---|
| SEC-20 | MUST: same-origin endpoint `https://carlos.nz/api/contact` (D4, D8). It accepts POST only, requires an `Origin` header equal to the site origin, accepts form content types only, and rejects bodies over 20 KB. |
| SEC-21 | MUST: validate on the server: required fields; lengths (name ≤ 100, email ≤ 254, message ≤ 5,000); email format. Reject line breaks in the name and email, to prevent header injection. |
| SEC-22 | MUST: verify Turnstile on the server on every submission through `siteverify`, checking `success`, `hostname` and `action`. The secret lives only in Worker secrets. Tokens are at most 2,048 characters. |
| SEC-23 | MUST: fail closed when Turnstile or Supabase is unavailable, with an accessible message and the email alternative. The browser keeps the typed text (A11Y-83). |
| SEC-24 | MUST: create the Turnstile token at submit time (`execution: "execute"`). Tokens expire after 300 seconds and are single-use; on `timeout-or-duplicate` the person is asked to press Send again, without retyping. |
| SEC-25 | MUST: a filled honeypot gets a fake success and the message is discarded. A submission faster than 2 seconds gets a generic "please send again" message. Never silently drop a message that could be from a person. |
| SEC-26 | MUST: rate-limit `/api/contact` at the edge with a Cloudflare WAF rate-limiting rule (for example 5 requests per 10 minutes per IP; tune as needed). |
| SEC-27 | MUST NOT: store IP addresses, user agents or Turnstile tokens. Store only name, email, message, timestamp and the version of the collection notice shown. |
| SEC-28 | MUST: write to `contact_messages` with the Worker's own secret key (RLS on, no policies). |
| SEC-29 | MUST NOT: put visitor input into email headers, except a validated `Reply-To`. Escape visitor input wherever it is shown as HTML (notification email, admin view). |
| SEC-30 | MUST: logs contain event names and status codes only: no names, email addresses or message text. |
| SEC-31 | MUST: responses use `cache-control: no-store`. Errors are generic: no stack traces or upstream error bodies. |
| SEC-32 | MUST: the Turnstile script loads only on `/contact/`. |

`worker/wrangler.toml`:

```toml
name = "carlos-nz-contact"
main = "src/index.ts"
compatibility_date = "2026-11-01"
workers_dev = false
routes = [{ pattern = "carlos.nz/api/contact", zone_name = "carlos.nz" }]

[vars]
ALLOWED_ORIGIN = "https://carlos.nz"
CONTACT_EMAIL = "replace-with-the-D2-alias@carlos.nz"
NOTICE_VERSION = "2026-11"

# Secrets: set with `npx wrangler secret put <NAME>`; never commit them.
# TURNSTILE_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY
```

`worker/src/index.ts`:

```ts
/**
 * carlos.nz contact endpoint: Cloudflare Worker on carlos.nz/api/contact.
 * Rules: SEC-20 to SEC-31, A11Y-80 to A11Y-85, PRIV-01.
 */
export interface Env {
  ALLOWED_ORIGIN: string;      // "https://carlos.nz"
  CONTACT_EMAIL: string;       // decision D2
  NOTICE_VERSION: string;      // version of the collection notice shown on the form
  TURNSTILE_SECRET: string;    // secret
  SUPABASE_URL: string;        // secret
  SUPABASE_SECRET_KEY: string; // secret (sb_secret_…), used only by this Worker
}

type Field = "name" | "email" | "message" | "form";
type Errors = Partial<Record<Field, string>>;
type Verification = "ok" | "expired" | "failed" | "unavailable";

const LIMITS = { name: 100, email: 254, message: 5000 } as const;
const MAX_BODY_BYTES = 20_000;
const MIN_FILL_MS = 2_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

function validate(name: string, email: string, message: string): Errors {
  const errors: Errors = {};
  if (!name) errors.name = "Enter your name.";
  else if (name.length > LIMITS.name || name.includes("\n")) {
    errors.name = `Enter your name on one line, using up to ${LIMITS.name} characters.`;
  }
  if (!email) errors.email = "Enter your email address.";
  else if (email.length > LIMITS.email || email.includes("\n") || !EMAIL_PATTERN.test(email)) {
    errors.email = "Enter an email address in the format name@example.com.";
  }
  if (!message) errors.message = "Enter your message.";
  else if (message.length > LIMITS.message) {
    errors.message = `Your message is too long. Use up to ${LIMITS.message} characters.`;
  }
  return errors;
}

async function verifyTurnstile(token: string, ip: string | null, env: Env): Promise<Verification> {
  if (!token || token.length > 2048) return "failed";
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const response = await fetch(SITEVERIFY, { method: "POST", body });
    if (!response.ok) return "unavailable";
    const result = (await response.json()) as {
      success: boolean;
      hostname?: string;
      action?: string;
      "error-codes"?: string[];
    };
    if (result.success) {
      const expectedHost = new URL(env.ALLOWED_ORIGIN).hostname;
      return result.hostname === expectedHost && result.action === "contact" ? "ok" : "failed";
    }
    return result["error-codes"]?.includes("timeout-or-duplicate") ? "expired" : "failed";
  } catch {
    return "unavailable";
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const unavailable =
      `The contact form is not working right now. Your message has not been sent. ` +
      `Please email ${env.CONTACT_EMAIL} instead.`;

    if (request.method !== "POST") return reply(405, { ok: false });
    if (request.headers.get("origin") !== env.ALLOWED_ORIGIN) return reply(403, { ok: false });
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data") &&
        !contentType.startsWith("application/x-www-form-urlencoded")) {
      return reply(415, { ok: false });
    }
    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return reply(413, { ok: false });

    let form: FormData;
    try {
      form = await new Response(raw, { headers: { "content-type": contentType } }).formData();
    } catch {
      return reply(400, { ok: false });
    }

    // Honeypot: only bots fill it. Pretend success and discard (SEC-25).
    if (text(form.get("reference_code")) !== "") return reply(200, { ok: true });

    // Minimum fill time: it could be a fast person, so ask them to send again rather than dropping it (SEC-25).
    const startedAt = Number(text(form.get("started_at")));
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) {
      return reply(400, {
        ok: false,
        errors: { form: "That was very quick. Please check your message and select Send message again." },
      });
    }

    const name = text(form.get("name"));
    const email = text(form.get("email"));
    const message = text(form.get("message"));
    const errors = validate(name, email, message);
    if (Object.keys(errors).length > 0) return reply(422, { ok: false, errors });

    const verification = await verifyTurnstile(
      text(form.get("cf-turnstile-response")),
      request.headers.get("cf-connecting-ip"),
      env,
    );
    if (verification === "unavailable") return reply(503, { ok: false, errors: { form: unavailable } });
    if (verification !== "ok") {
      return reply(409, {
        ok: false,
        errors: {
          form: verification === "expired"
            ? "The security check timed out. Your message is still here. Please select Send message again."
            : `The security check did not work. Please select Send message again, or email ${env.CONTACT_EMAIL}.`,
        },
      });
    }

    try {
      const stored = await fetch(`${env.SUPABASE_URL}/rest/v1/contact_messages`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          "content-type": "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify({ name, email, message, notice_version: env.NOTICE_VERSION }),
      });
      if (!stored.ok) {
        console.error(JSON.stringify({ event: "store_failed", status: stored.status }));
        return reply(503, { ok: false, errors: { form: unavailable } });
      }
    } catch {
      console.error(JSON.stringify({ event: "store_unreachable" }));
      return reply(503, { ok: false, errors: { form: unavailable } });
    }
    return reply(200, { ok: true });
  },
};
```

If you want an email notification, use an email API or Cloudflare Email Routing from the Worker. The only visitor data in headers is the validated `Reply-To` (SEC-29).

### 5.4 Information disclosure guard (A01, CWE-200)

Text equivalents are excellent for accessibility, but they also turn a picture of your homelab into a searchable inventory that is easy to scrape. These rules keep both goals.

| ID | Rule |
|---|---|
| SEC-40 | MUST: describe the homelab's architecture, not its addressing. Never publish real IP addresses (public or private), MAC addresses, internal hostnames, tunnel or internal domain names, usernames, exposed ports, or software versions of exposed services. |
| SEC-41 | MUST: examples use documentation values: IPv4 `192.0.2.0/24`, `198.51.100.0/24` and `203.0.113.0/24` (RFC 5737), IPv6 `2001:db8::/32` (RFC 3849), and `example.com`, `example.net`, `example.org` or `*.example` (RFC 2606). |
| SEC-42 | MUST: redact images (screenshots, diagrams) and their text alternatives in the same way. The image, the `alt` and the long description hide the same things. |
| SEC-43 | MUST: CI runs `scripts/content_guard.py` on the built site. It flags IP addresses outside the documentation ranges, MAC addresses, secret patterns, Supabase keys, and terms from a private deny-list kept in a GitHub Actions secret (never committed). |
| SEC-44 | MUST: GitHub secret scanning and push protection are enabled. If the repository is private and they are not available, run `gitleaks` in CI and as a pre-commit hook. |
| SEC-45 | MUST: CI logs never print a finding in full (logs of a public repository are public). The script redacts them. |
| SEC-46 | MUST: PDF metadata is minimal: title, author name, language. No file paths or usernames. |
| SEC-47 | MUST NOT: publish a phone number, home address or date of birth on the site or in the CV. |

`scripts/content_guard.py` was tested: it flags private IPs, link-local IPv6, MAC addresses, Supabase secret keys and deny-list terms, and ignores documentation ranges, loopback addresses, times and CSS pseudo-elements.

```python
"""Fail the build if published files reveal secrets or real network details (SEC-40 to SEC-45).

Usage: python scripts/content_guard.py _site
Private deny-list: CONTENT_GUARD_DENYLIST (GitHub Actions secret, one term per line).
Reviewed exceptions: .content-guard-allow (one exact string per line, e.g. a four-part version number).
"""
import ipaddress
import os
import re
import sys
from pathlib import Path

SCANNED_SUFFIXES = {".html", ".svg", ".xml", ".txt", ".json"}
DOCUMENTATION_NETWORKS = [
    ipaddress.ip_network(net)
    for net in ("192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24", "2001:db8::/32")
]
IPV4 = re.compile(r"(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])")
IPV6 = re.compile(r"(?<![0-9A-Za-z:])[0-9A-Fa-f]{0,4}(?::[0-9A-Fa-f]{0,4}){2,7}(?![0-9A-Za-z:])")
MAC = re.compile(r"(?<![0-9A-Fa-f:])(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}(?![0-9A-Fa-f:])")
SECRETS = {
    "Supabase secret key": re.compile(r"sb_secret_[A-Za-z0-9_-]{8,}"),
    "Supabase publishable key (SEC-10)": re.compile(r"sb_publishable_[A-Za-z0-9_-]{8,}"),
    "JSON Web Token": re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}"),
    "GitHub token": re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})"),
    "AWS access key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "Private key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
}


def _is_allowed_ip(value: str) -> bool | None:
    """True if allowed, False if it must be flagged, None if it is not an IP address."""
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return None
    if address.is_loopback or address.is_unspecified:
        return True
    return any(address in network for network in DOCUMENTATION_NETWORKS)


def find_problems(line: str, deny: list[str]):
    for match in IPV4.findall(line) + IPV6.findall(line):
        if _is_allowed_ip(match) is False:
            yield "IP address outside documentation ranges (SEC-41)", match
    for match in MAC.findall(line):
        yield "MAC address (SEC-40)", match
    for kind, pattern in SECRETS.items():
        for match in pattern.findall(line):
            yield kind, match
    lowered = line.lower()
    for term in deny:
        if term in lowered:
            yield "private deny-list term (SEC-43)", term


def redact(value: str) -> str:
    """CI logs of a public repository are public: never print the full finding (SEC-45)."""
    return value[:3] + "…" if len(value) > 3 else "…"


def scan(root: Path, deny: list[str], allow: set[str]) -> list[str]:
    findings = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SCANNED_SUFFIXES:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for number, line in enumerate(text.splitlines(), start=1):
            for kind, value in find_problems(line, deny):
                if value not in allow:
                    findings.append(f"{path.relative_to(root)}:{number}: {kind}: {redact(value)}")
    return findings


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
    deny = [t.strip().lower() for t in os.environ.get("CONTENT_GUARD_DENYLIST", "").splitlines() if t.strip()]
    allow_file = Path(".content-guard-allow")
    allow = set(allow_file.read_text(encoding="utf-8").split()) if allow_file.exists() else set()
    findings = scan(root, deny, allow)
    for finding in findings:
        print(finding, file=sys.stderr)
    print(f"content guard: {len(findings)} finding(s)")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
```

### 5.5 HTTP headers and Content Security Policy (A02, A04)

| ID | Rule |
|---|---|
| SEC-50 | MUST: set security headers with Cloudflare Response Header Transform Rules on the proxied DNS record. GitHub Pages cannot set custom headers, and a `<meta>` CSP cannot use `frame-ancestors`, `report-uri` or `sandbox`. |
| SEC-51 | MUST: all HTML responses carry the baseline headers below. |
| SEC-52 | MUST: `/contact/` adds only the two Turnstile directives. If D3 enables Cloudflare Web Analytics, add its script and beacon hosts (check Cloudflare's current documentation) and nothing else. |
| SEC-53 | MUST NOT: inline scripts, inline styles, `style` attributes or event-handler attributes. Everything is in external files from `'self'`, so the CSP needs no `'unsafe-inline'`. |
| SEC-54 | MUST: HTTPS only, with HSTS of at least one year once HTTPS is confirmed. Add `includeSubDomains` only after confirming every subdomain serves HTTPS (D8). Preloading is optional and hard to undo. |
| SEC-55 | MUST: after any header change, check with Mozilla HTTP Observatory and Google's CSP Evaluator. |
| SEC-56 | SHOULD: roll out CSP changes first as `Content-Security-Policy-Report-Only` for about a week. |

Baseline headers (all HTML):

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; media-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
```

Override for `/contact/` only:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; media-src 'self'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

### 5.6 Third parties (A03, A08)

| ID | Rule |
|---|---|
| SEC-60 | MUST: every third party appears in the register below and in the privacy statement before it is used (GOV-02). |
| SEC-61 | MUST NOT: load scripts, styles, fonts or images from CDNs; self-host them. The one exception is Turnstile, which must load from Cloudflare. |
| SEC-62 | MUST NOT: embed iframes or widgets (LinkedIn, social share buttons, video) except under A11Y-111. |
| SEC-63 | MUST NOT: install accessibility overlays or widgets. A compromised third-party script runs with full page access; the Polyfill.io takeover in 2024 injected malicious code into more than 100,000 sites. |

| Third party | Purpose | Personal information processed | Where it runs | Privacy Act role |
|---|---|---|---|---|
| Cloudflare | DNS, proxy and CDN, security headers, WAF, Turnstile, Worker, Email Routing (D2), analytics (D3) | IP address and browser signals (Turnstile); form content in transit (Worker) | Visitor browser (Turnstile on /contact/ only); edge | Agent / service provider |
| GitHub | Code, CI, Pages hosting | Visitor IP in hosting logs | Server side | Service provider |
| Supabase | Content and contact messages | Name, email, message | Server side (record the project region) | Agent: stores on your behalf |
| LinkedIn API | Cross-posting; posts for build-time cards | Your own data | CI only | — |
| pip, npm, GitHub Actions publishers | Build dependencies | None | CI only | Supply-chain risk (§5.7) |

### 5.7 CI/CD and supply chain (A03, A08)

| ID | Rule |
|---|---|
| SEC-70 | MUST: every third-party action is pinned to a full commit SHA, with the version as a comment. Use `pinact` or Dependabot to keep them updated. In March 2025 the `tj-actions/changed-files` compromise exposed CI secrets in logs across more than 23,000 repositories (CVE-2025-30066). |
| SEC-71 | MUST: `permissions: {}` at workflow level, with the minimum per job. |
| SEC-72 | MUST: secrets go only to the steps that need them. The test job has no secrets; the deploy job has only `pages: write` and `id-token: write`. |
| SEC-73 | MUST: `actions/checkout` uses `persist-credentials: false`. |
| SEC-74 | MUST: Python dependencies are hash-locked (`pip-compile --generate-hashes` or `uv pip compile --generate-hashes`) and installed with `--require-hashes`. npm uses `npm ci` with a committed lockfile. |
| SEC-75 | MUST: Dependabot covers pip, npm and GitHub Actions. SHOULD: wait about 7 days before merging a brand-new upstream release, unless it fixes a vulnerability, because malicious releases are usually caught within days. |
| SEC-76 | MUST: keep minimum versions: WeasyPrint 70.0 or later, mermaid 11.15.0 or later (or 10.9.6 or later); keep Pygments, nh3, Jinja2, markdown-it-py, Playwright and Wrangler current. |
| SEC-77 | MUST NOT: use `pull_request_target`, or run code from untrusted pull requests with secrets. |
| SEC-78 | MUST: Dependabot pull requests have no access to Actions secrets, so the build falls back to `content/fixtures/` when `SUPABASE_URL` is empty. Never expose secrets to make them pass. |
| SEC-79 | SHOULD: LinkedIn posting runs in its own workflow, with the token in a GitHub Environment secret, minimal scopes, and a calendar reminder before the token expires. |

`.github/workflows/site.yml`:

```yaml
# SEC-70 to SEC-79, TEST-01 to TEST-09
name: Build, test and deploy

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions: {}

concurrency:
  group: site-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<FULL_COMMIT_SHA> # vX.Y.Z
        with:
          persist-credentials: false
      - uses: actions/setup-python@<FULL_COMMIT_SHA> # vX.Y.Z
        with:
          python-version: "3.13"
      - uses: actions/setup-node@<FULL_COMMIT_SHA> # vX.Y.Z (mermaid-cli only)
        with:
          node-version: "24"
      - name: Install locked dependencies
        run: |
          python -m pip install --require-hashes -r requirements.txt
          npm ci
      - name: Build site (falls back to content/fixtures when secrets are absent; SEC-78)
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_BUILD_SECRET_KEY }}
        run: python -m site_builder --out _site
      - name: Content guard (SEC-43)
        env:
          CONTENT_GUARD_DENYLIST: ${{ secrets.CONTENT_GUARD_DENYLIST }}
        run: python scripts/content_guard.py _site
      - uses: actions/upload-artifact@<FULL_COMMIT_SHA> # vX.Y.Z
        with:
          name: site
          path: _site
          retention-days: 3

  test:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<FULL_COMMIT_SHA> # vX.Y.Z
        with:
          persist-credentials: false
      - uses: actions/setup-python@<FULL_COMMIT_SHA> # vX.Y.Z
        with:
          python-version: "3.13"
      - run: python -m pip install --require-hashes -r requirements-test.txt
      - run: python -m playwright install --with-deps chromium
      - uses: actions/download-artifact@<FULL_COMMIT_SHA> # vX.Y.Z
        with:
          name: site
          path: _site
      - name: Contrast of design tokens and code styles (A11Y-11, A11Y-71)
        run: python scripts/check_contrast.py design/tokens.json
      - name: Accessibility tests (TEST-01 to TEST-09)
        run: |
          python -m http.server 8000 --directory _site --bind 127.0.0.1 &
          python -m pytest tests/a11y -q

  deploy:
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    needs: [build, test]
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/download-artifact@<FULL_COMMIT_SHA> # vX.Y.Z
        with:
          name: site
          path: _site
      - uses: actions/upload-pages-artifact@<FULL_COMMIT_SHA> # vX.Y.Z
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@<FULL_COMMIT_SHA> # vX.Y.Z
```

Replace every `<FULL_COMMIT_SHA> # vX.Y.Z` with the SHA of the current release (for example with `pinact run`). Dependabot keeps them updated after that.

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/worker"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### 5.8 Client-side JavaScript (A05)

| ID | Rule |
|---|---|
| SEC-80 | MUST NOT: use `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` with any variable data. Use `textContent`, `createElement`, `append` and `replaceChildren`. |
| SEC-81 | MUST: check values from `localStorage`, the URL or server responses against allow-lists before using them. |
| SEC-82 | MUST: `localStorage` holds only `a11y-prefs`: never personal information or tokens. No cookies. |
| SEC-83 | MUST NOT: use `eval`, `new Function` or string arguments to `setTimeout` or `setInterval`. |
| SEC-84 | MUST: the copy button copies only the visible code (`code.textContent`). |

### 5.9 Logging, errors and incident response (A09, A10)

| ID | Rule |
|---|---|
| SEC-90 | MUST: messages shown to users are generic, accessible and actionable. Detail goes only to logs, without personal information. |
| SEC-91 | SHOULD: turn on Cloudflare notifications for Worker errors and Supabase usage alerts. |
| SEC-92 | MUST: publish `/.well-known/security.txt` (RFC 9116) with a contact address and an `Expires` date, and renew it before it expires. |
| SEC-93 | MUST: follow the incident runbook: **contain** (disable the `/api/contact` route; rotate Supabase secret keys, the Turnstile secret, and GitHub and LinkedIn tokens as relevant), **assess** (was personal information involved? see §6.7), **notify** if required, **fix** the root cause and add a test, **record** it in a private incident log. |
| SEC-94 | SHOULD: review accounts, keys and the third-party register every six months, together with this guide. |

---

## 6. Privacy and New Zealand law

### 6.1 Which laws apply

| Law or standard | Applies to carlos.nz? | What it means here | Rules |
|---|---|---|---|
| Privacy Act 2020 (with the Privacy Amendment Act 2025) | Yes. The site promotes professional services, so do not rely on the personal and domestic affairs exemption. | The IPPs in §6.2; breach notification; you are the privacy officer | PRIV-01 to PRIV-14 |
| IPP 3A (indirect collection), in force since 1 May 2026 | Only if you collect information about people from someone other than them | Notification duty for information collected on or after 1 May 2026 | PRIV-04 |
| Human Rights Act 1993 | Indirectly: disability is a prohibited ground, and s 44 covers providing goods and services | Treat reported barriers as priority defects | LAW-03 |
| NZ Government Web Accessibility Standard 1.2 | No (government only); used as the benchmark | WCAG 2.2 AA | §1.2 |
| Unsolicited Electronic Messages Act 2007 | Only if you send commercial electronic messages | Consent, sender information, functional unsubscribe | LAW-01 |
| Fair Trading Act 1986 | Likely, for representations made in trade (promoting your consultancy) | Accessibility and service claims must not mislead | LAW-02 |
| Copyright Act 1994 | Yes | Licences for fonts, icons and images | LAW-04 |
| Te Ture mō Te Reo Māori 2016; New Zealand Sign Language Act 2006 | Recognise official languages; no direct duty on private sites | Correct te reo Māori; NZSL only with accredited interpreters | LAW-05 |
| Harmful Digital Communications Act 2015 | Avoided by not hosting user-generated content | No comments | LAW-06 |
| GDPR | Your voluntary standard | Lawful basis, rights, no special-category data | LAW-07 |

Accessibility legislation status: the government stopped work on the Accessibility for New Zealanders Bill in August 2024. In 2026 a member's bill, the Accessibility Standards Bill (Jenny Marcroft MP, NZ First), was lodged. It is not law. See the watch list in §6.8.

### 6.2 Information privacy principles applied

| IPP | What carlos.nz does | Rule |
|---|---|---|
| 1 Purpose | Collects only what is needed to reply: name, email, message | PRIV-01 |
| 2 Source | Directly from the person, through the form | — |
| 3 Collection notice | Short notice above the form; full privacy statement at `/privacy/` | PRIV-02, PRIV-03 |
| 3A Indirect collection | Checked before publishing information about others | PRIV-04 |
| 4 Manner | Fair and not intrusive: no tracking, no assistive-technology detection | PRIV-10 |
| 5 Storage and security | §5 of this guide | PRIV-05 |
| 6 and 7 Access and correction | Answered within 20 working days | PRIV-06 |
| 8 Accuracy | People can correct their details on request | PRIV-06 |
| 9 Retention | Deleted after the D1 period (automatic job) | PRIV-07 |
| 10 and 11 Use and disclosure | Used only to reply; not shared | PRIV-08 |
| 12 Cross-border | Overseas providers act as agents (Privacy Act s 11) and do not use the data for their own purposes; you remain responsible | PRIV-09 |
| 13 Unique identifiers | None assigned | — |

| ID | Rule |
|---|---|
| PRIV-01 | MUST: collect only name, email and message. No phone number, company or "how did you hear about me" fields unless a decision is recorded. |
| PRIV-02 | MUST: show a short collection notice above the form (§6.4) and store the notice version with each message. |
| PRIV-03 | MUST: `/privacy/` explains: who you are and how to contact you; what is collected and why; who receives it (Cloudflare, Supabase, GitHub, as agents); where it is stored; how long it is kept; whether providing it is voluntary (yes) and what happens if you don't (you can email instead); the rights to access and correct; how to complain to the Office of the Privacy Commissioner; that the site uses no cookies or tracking; and what `localStorage` is used for. |
| PRIV-04 | MUST: before publishing or storing information about other people that you obtained from someone else (LinkedIn recommendations, testimonials, colleagues' names or photos in posts, or third-party details someone sends in a message), check the IPP 3A notification duty using the OPC guidance and ask Carlos (GOV-02). |
| PRIV-05 | MUST: apply §5 in full. The security safeguards are what IPP 5 requires. |
| PRIV-06 | MUST: answer access and correction requests as soon as reasonably practicable, and within 20 working days at most. |
| PRIV-07 | MUST: delete contact messages after the D1 period, with the scheduled job in §6.5. |
| PRIV-08 | MUST: use contact details only to reply. Never add anyone to a mailing list without express consent (LAW-01). |
| PRIV-09 | MUST: confirm in each provider's terms that it does not use the data for its own purposes, and record the Supabase project region. |
| PRIV-10 | MUST NOT: detect, infer, store or transmit assistive-technology use or accessibility preferences. Never send `prefers-*` values, `forced-colors` state or display-settings choices to analytics, logs or Supabase. These signals can reveal disability and add fingerprinting entropy. Under the GDPR, data that reveals disability can be special-category (health) data. |
| PRIV-11 | MUST: set no cookies, so the site needs no cookie banner. `localStorage` holds only the display settings the person chose (strictly necessary for a function they asked for), and the privacy statement says so. |
| PRIV-12 | MUST: analytics only if D3 says yes. Then: cookieless, no custom events, no IP storage, and listed in the privacy statement. |
| PRIV-13 | MUST: name Carlos as privacy officer on `/privacy/`. |
| PRIV-14 | MUST: follow the breach procedure in §6.7. |

### 6.3 Other legal rules

| ID | Rule |
|---|---|
| LAW-01 | MUST: replying to an enquiry is fine. Any commercial electronic message (a newsletter, a promotional follow-up) requires consent, accurate sender information and a functional unsubscribe facility. You carry the burden of proving consent, so record it (double opt-in). No address harvesting. |
| LAW-02 | MUST: the accessibility statement and any claims about services must be accurate. Do not write "fully accessible" or "WCAG compliant" unless it has been tested and is true. Always give the date, the scope, the method and the known issues. |
| LAW-03 | MUST: triage barriers reported through the feedback channel as defects, with a target response time, and fix them or offer an accessible alternative. |
| LAW-04 | MUST: use only content you own or have licensed. Record font, icon and image licences in `LICENCES.md`. Don't use photos of other people without their consent. |
| LAW-05 | MUST: write te reo Māori correctly, with macrons. NZSL content only through accredited interpreters (INNOV-21). |
| LAW-06 | MUST NOT: host comments or other user-generated content. Adding them later needs a moderation and complaints process first. |
| LAW-07 | SHOULD (voluntary GDPR alignment): lawful basis for the contact form = legitimate interests in replying; honour data-subject rights the same way as under the Privacy Act; no special-category data (PRIV-10). |

### 6.4 Collection notice (shown above the contact form)

```html
<p id="contact-notice">
  I collect your name, email address and message so I can reply to you. They are stored by Supabase (my database
  provider) and pass through Cloudflare (my network and spam-protection provider), who act on my behalf. Cloudflare's
  spam check reads technical information from your browser. I keep messages for 12 months and then delete them. You can
  ask to see or correct your information at any time. Read the <a href="/privacy/">privacy statement</a>.
</p>
```

Update "12 months" to match D1, and increase `NOTICE_VERSION` whenever this text changes.

### 6.5 Retention (IPP 9)

Enable `pg_cron` (Supabase: Database → Extensions), then:

```sql
-- PRIV-07, decision D1: delete contact messages older than 12 months, every day at 15:17 UTC.
select cron.schedule(
  'purge-contact-messages',
  '17 15 * * *',
  $$delete from public.contact_messages where created_at < now() - interval '12 months'$$
);
```

### 6.6 Access and correction requests (IPP 6 and 7)

1. Confirm the requester's identity by replying from the stored email address.
2. Search `contact_messages` by email.
3. Provide a copy, or correct or delete it, within 20 working days at most.
4. Record the request and your response in a private log.

### 6.7 Privacy breach procedure (Privacy Act Part 6)

1. **Contain**: SEC-93.
2. **Assess** whether it is reasonable to believe the breach has caused, or is likely to cause, serious harm. Consider how sensitive the information is, what harm could follow, who obtained it, whether security measures protected it, and what you have already done to reduce the harm.
3. **Notify**: if the breach is notifiable, tell the Office of the Privacy Commissioner (through its NotifyUs tool) and the affected people as soon as practicable. Failing to notify the Commissioner without reasonable excuse is an offence, with a fine of up to $10,000.
4. **Record** every breach, including the ones that are not notifiable.
5. **Learn**: fix the root cause and add a test or rule to this guide.

### 6.8 Watch list (review every six months)

- Accessibility Standards Bill (member's bill, 2026): is it drawn or introduced, and does it cover digital services?
- WCAG 3.0 drafts and the contrast algorithm decision.
- NZ Government Web Standards (Web Accessibility Standard 1.2, Web Usability Standard 1.4).
- WAI-Adapt (Personalization Semantics) support in browsers.
- OPC guidance updates (IPP 3A, biometrics, AI).
- Supabase's retirement of the legacy keys (late 2026): confirm none are still in use.

---

## 7. Testing and verification

Automated tools catch only part of the barriers that exist. The WebAIM Million numbers are a floor, not a ceiling. Manual and user testing are required.

### 7.1 Automated in CI (blocking unless marked)

| ID | Check | Tool |
|---|---|---|
| TEST-01 | No axe violations (WCAG 2.0, 2.1, 2.2 A/AA) on every page, in light, dark and forced-colours modes | Playwright + `axe-playwright-python` |
| TEST-02 | The skip link is the first focus stop and moves focus to `main` | Playwright |
| TEST-03 | Reflow at 320 CSS px: no horizontal page scrolling | Playwright |
| TEST-04 | The display settings dialog closes with Esc and returns focus | Playwright |
| TEST-05 | No running animations with reduced motion | Playwright |
| TEST-06 | Contrast of design tokens and code styles | `check_contrast.py` |
| TEST-07 | Media accessibility fields | `check_media()` during the build |
| TEST-08 | Content guard (secrets, addresses, deny-list) | `content_guard.py` |
| TEST-09 | Sanitiser unit tests (`<script>`, `onerror`, `javascript:`, `data:`, `h1` injection) | pytest |
| TEST-10 | Reading level (warning only) | `textstat` |
| TEST-11 | Performance (information only) | Lighthouse CI |

`tests/a11y/test_pages.py`. The `wcag22aa` tag needs axe-core 4.5 or later. If the axe-core bundled with `axe-playwright-python` is older, load a current `axe.min.js` (npm package `axe-core`) through the package's load-from-file option; see its API docs.

```python
"""Accessibility checks on the built site (TEST-01 to TEST-05).

Run against: python -m http.server 8000 --directory _site --bind 127.0.0.1
"""
import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page

BASE_URL = "http://127.0.0.1:8000"
PAGES = ["/", "/about/", "/experience/", "/projects/", "/labs/", "/posts/", "/contact/", "/accessibility/", "/privacy/"]
AXE_OPTIONS = {
    "runOnly": {"type": "tag", "values": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]},
    "resultTypes": ["violations"],
}
MEDIA = [{"color_scheme": "light"}, {"color_scheme": "dark"}, {"forced_colors": "active"}]


@pytest.mark.parametrize("media", MEDIA, ids=["light", "dark", "forced-colours"])
@pytest.mark.parametrize("path", PAGES)
def test_no_axe_violations(page: Page, path: str, media: dict) -> None:
    page.emulate_media(**media)
    page.goto(BASE_URL + path)
    results = Axe().run(page, options=AXE_OPTIONS)
    assert results.violations_count == 0, results.generate_report()


def test_skip_link_is_first_and_moves_focus(page: Page) -> None:
    page.goto(BASE_URL + "/")
    page.keyboard.press("Tab")
    assert page.evaluate("document.activeElement.getAttribute('href')") == "#main"
    page.keyboard.press("Enter")
    assert page.evaluate("document.activeElement.id") == "main"


@pytest.mark.parametrize("path", PAGES)
def test_reflows_at_320_css_px(page: Page, path: str) -> None:
    page.set_viewport_size({"width": 320, "height": 800})
    page.goto(BASE_URL + path)
    assert page.evaluate("document.documentElement.scrollWidth") <= 320


def test_display_settings_dialog_returns_focus(page: Page) -> None:
    page.goto(BASE_URL + "/")
    page.locator("#display-settings-open").click()
    assert page.locator("#display-settings").evaluate("dialog => dialog.open")
    page.keyboard.press("Escape")
    assert page.evaluate("document.activeElement.id") == "display-settings-open"


def test_reduced_motion_has_no_running_animations(page: Page) -> None:
    page.emulate_media(reduced_motion="reduce")
    page.goto(BASE_URL + "/")
    assert page.evaluate("document.getAnimations().length") == 0
```

### 7.2 Manual checks for every layout or component change

- [ ] Keyboard only: Tab, Shift+Tab, Enter, Space, Esc through the menu, display settings, code copy and contact form, including an error and a timed-out security check.
- [ ] Zoom to 200% and 400%; check reflow at 320 px.
- [ ] Apply the WCAG 1.4.12 text-spacing bookmarklet: nothing is clipped or overlaps.
- [ ] Windows contrast themes (forced colours), dark and high-contrast themes, `prefers-reduced-motion`.
- [ ] Colour-vision deficiency simulation in DevTools (protanopia, deuteranopia, tritanopia, achromatopsia).
- [ ] WAVE inspection of new pages.
- [ ] Every new diagram: read the text description without looking at the image. Does it convey everything?
- [ ] Every new homelab post: SEC-40 to SEC-42 redaction review.

### 7.3 Assistive technology matrix (each release with UI changes)

| Assistive technology | Browser | Tasks |
|---|---|---|
| NVDA (Windows) | Firefox and Chrome | Navigate by headings; read a diagram description; copy code; submit the form with an error |
| JAWS (Windows; free 40-minute demo mode) | Chrome | Same |
| VoiceOver (macOS) | Safari | Same, plus scrolling code blocks |
| VoiceOver (iOS) | Safari | Same, on mobile |
| TalkBack (Android) | Chrome | Same, on mobile |
| Voice Control (macOS/iOS), Voice Access (Android) | Safari / Chrome | Say visible labels: "click Projects", "click Send message" |
| Windows Magnifier or browser zoom | Edge | Read a post at 300%; open display settings |

### 7.4 Testing with disabled people

- At least once a year, and after major redesigns, test with 3–5 disabled people across different impairments. Recruit through NZ organisations such as Blind Low Vision NZ, Deaf Aotearoa, Dyslexia Foundation of New Zealand or the Disabled Persons Assembly NZ. **Pay them for their time.**
- Tasks: "Find out what Carlos does", "Find the Proxmox lab", "Understand the homelab diagram", "Send Carlos a message".
- Privacy: get informed consent; record only with explicit consent; delete recordings after analysis; tell participants how long notes are kept.

### 7.5 Security verification

- [ ] Supabase Security Advisor: zero RLS findings (SEC-13).
- [ ] Mozilla HTTP Observatory and CSP Evaluator after header changes (SEC-55).
- [ ] `/api/contact` rejects: GET, a foreign `Origin`, a body over 20 KB, an unsupported content type, a missing or expired token.
- [ ] Turnstile with a screen reader and over a VPN: you can still get through, or the email alternative works.
- [ ] `content_guard.py` passes; no secrets in the repository history (secret scanning).
- [ ] Dependabot alerts: none open above "low".

---

## 8. Definition of done

Copy this into the pull request template (`.github/pull_request_template.md`):

```markdown
## Rules applied
<!-- List rule IDs, e.g. A11Y-31, SEC-22 -->

## Accessibility
- [ ] Semantic HTML, one h1, headings in order, landmarks (A11Y-01 to A11Y-03)
- [ ] Contrast checked in light, dark and high-contrast themes (A11Y-11, TEST-06)
- [ ] Keyboard and visible focus; dialogs return focus (A11Y-30 to A11Y-33)
- [ ] Works at 400% zoom / 320 px and with text-spacing overrides (A11Y-20, A11Y-21)
- [ ] Images have correct alt; complex images have long descriptions (A11Y-60 to A11Y-64)
- [ ] No new motion outside prefers-reduced-motion (A11Y-41)
- [ ] Accessible names match visible labels (A11Y-35)
- [ ] Plain-language summary for new pages or posts (A11Y-90)
- [ ] TEST-01 to TEST-09 pass

## Security and privacy
- [ ] No new third-party script, font, embed or service, or Carlos approved it and the register, CSP and privacy statement are updated (GOV-02, SEC-60)
- [ ] No innerHTML with variable data; inputs allow-listed (SEC-80, SEC-81)
- [ ] No homelab addresses, hostnames, versions or secrets in text or images (SEC-40 to SEC-45)
- [ ] No new personal data collected, or the notice, privacy statement and retention are updated (PRIV-01 to PRIV-03, PRIV-07)
- [ ] Actions pinned to SHAs; dependencies locked (SEC-70, SEC-74)
- [ ] Content written in New Zealand English (GOV-04)
```

---

## 9. Accessibility statement template

Publish at `/accessibility/`. Keep it accurate (LAW-02) and update it after each audit.

```markdown
# Accessibility

I want everyone to be able to use carlos.nz, whatever device, settings or assistive technology you use.

## Standard
This site aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA, plus some Level AAA criteria
(enhanced contrast for body text, enhanced focus appearance, larger targets, section headings and plain-language summaries).

## What you can do on this site
- Zoom to 400% without losing content, and override text spacing.
- Use your device's light, dark, high-contrast and reduced-motion settings, or change them here with "Display settings"
  (saved only in your browser).
- Navigate by headings, landmarks and a skip link.
- Read text descriptions of every technical diagram.

## How I tested
Last tested: {date}. Automated checks with axe-core; manual keyboard and zoom checks; screen readers {NVDA with Firefox,
VoiceOver with Safari on iOS, …}; {user testing details, if any}.

## Known issues
- {Describe each known issue, the WCAG criterion, the workaround and the planned fix date. If there are none known, say so.}

## Feedback
If something does not work for you, tell me: {D2 email alias} or the contact form. I aim to reply within {D7}.
If I cannot fix it quickly, I will give you the information in another format.

This statement was prepared on {date} and last reviewed on {date}.
```

---

## 10. Evidence base and sources

### Standards and guidance

- W3C, Web Content Accessibility Guidelines (WCAG) 2.2: https://www.w3.org/TR/WCAG22/
- W3C, Making Content Usable for People with Cognitive and Learning Disabilities (COGA): https://www.w3.org/TR/coga-usable/
- NZ Government Web Accessibility Standard 1.2: https://www.digital.govt.nz/standards-and-guidance/nz-government-web-standards/web-accessibility-standard-1-2
- W3C TAG design principles, "do not expose use of assistive technology": https://w3ctag.github.io/design-principles/#do-not-expose-use-of-assistive-tech
- OWASP Top 10:2025: https://owasp.org/Top10/2025/
- OWASP Top 10 for LLM Applications 2025: https://genai.owasp.org/llm-top-10/

### New Zealand law and regulators

- Office of the Privacy Commissioner, IPP 3A guidance: https://www.privacy.org.nz/resources-and-learning/a-z-topics/ipp3a/
- Office of the Privacy Commissioner, disclosing personal information outside New Zealand (IPP 12): https://www.privacy.org.nz/disclosing-personal-information-outside-new-zealand/
- Ministry of Justice, Enhancing the Privacy Act (Privacy Amendment Act 2025): https://www.justice.govt.nz/justice-sector-policy/key-initiatives/enhancing-the-privacy-act
- Unsolicited Electronic Messages Act 2007: https://www.legislation.govt.nz/act/public/2007/7/en/latest/
- Whaikaha, Cabinet paper: Confirming the status of the Accessibility for New Zealanders Bill: https://www.whaikaha.govt.nz/assets/Cabinet-Papers/Hon-Louise-Upston/Cabinet-Paper-Confirming-the-status-of-the-Accessibility-for-New-Zealanders-Bill.pdf
- Access Matters Aotearoa, Accessibility Standards Bill: https://www.accessmatters.org.nz/accessibility_standards_bill_lodged_for_parliamentary_ballot_news
- Stats NZ, Disability statistics 2023: https://www.stats.govt.nz/information-releases/disability-statistics-2023/

### Accessibility research and surveys

- WebAIM, Screen Reader User Survey #11 (2026): https://webaim.org/projects/screenreadersurvey11/
- WebAIM, Low Vision Survey #2: https://webaim.org/projects/lowvisionsurvey2/
- WebAIM, The WebAIM Million: https://webaim.org/projects/million/
- WebAIM, Practitioner Survey #3: https://webaim.org/projects/practitionersurvey3/
- Zorzi, M. et al. (2012). Extra-large letter spacing improves reading in dyslexia. *PNAS*, 109(28).
- Rello, L. & Baeza-Yates, R. (2016). The effect of font type on screen readability by people with dyslexia. *ACM TACCESS*: https://dl.acm.org/doi/10.1145/2897736
- Rello, L., Pielot, M. & Marcos, M.-C. (2016). Make it big! The effect of font size and line spacing on online readability. *CHI 2016*: https://dl.acm.org/doi/10.1145/2858036.2858204
- Wery, J. J. & Diliberto, J. A. (2017). The effect of a specialized dyslexia font, OpenDyslexic, on reading rate and accuracy. *Annals of Dyslexia*.
- Kuster, S. M. et al. (2018). Dyslexie font does not benefit reading in children with or without dyslexia. *Annals of Dyslexia*.
- Piepenbrock, C., Mayr, S., Mund, I. & Buchner, A. (2013). Positive display polarity is advantageous for both younger and older adults. *Ergonomics*: https://pubmed.ncbi.nlm.nih.gov/23654206/
- Makati, T., Tigwell, G. W. & Shinohara, K. (2024). The Promise and Pitfalls of Web Accessibility Overlays for Blind and Low Vision Users. *ASSETS 2024*.
- Nielsen, J. (2008). How little do users read? Nielsen Norman Group: https://www.nngroup.com/articles/how-little-do-users-read/
- Mermaid accessibility issue #5632: https://github.com/mermaid-js/mermaid/issues/5632
- US FTC, accessiBe case: https://www.ftc.gov/legal-library/browse/cases-proceedings/2223156-accessibe-inc
- Overlay Fact Sheet: https://overlayfactsheet.com/

### Security and platform documentation

- Cloudflare Turnstile, server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Cloudflare Turnstile, Content Security Policy: https://developers.cloudflare.com/turnstile/reference/content-security-policy
- Supabase, Understanding API keys: https://supabase.com/docs/guides/api/api-keys
- Supabase, Migrating to publishable and secret API keys: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- CISA, tj-actions/changed-files compromise (CVE-2025-30066): https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-github-action-cve-2025-30066
- Sansec, Polyfill.io supply chain attack: https://sansec.io/research/polyfill-supply-chain-attack
- WeasyPrint advisory GHSA-jf6q-chmf-3h3v (CVE-2026-55073): https://github.com/advisories/GHSA-jf6q-chmf-3h3v
- axe-playwright-python: https://github.com/pamelafox/axe-playwright-python

---

## 11. Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 5 November 2026 | First version: evidence-ranked accessibility roadmap, OWASP Top 10:2025 security rules, NZ privacy and legal requirements, tested reference code. |
