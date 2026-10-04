# Security and privacy — carlos.nz

This document records the site's security and privacy decisions. It is not legal advice. If the site starts collecting more data, have it reviewed by a professional.

## 1. What needs protecting

| Asset | Where it lives | Risk if exposed |
|---|---|---|
| Contact-form messages (name, email, text) | Supabase, `contact_messages` table | Third parties' personal information exposed → notifiable breach |
| LinkedIn token | Supabase, `linkedin_credentials` (AES-256-GCM; key `LINKEDIN_TOKEN_KEY` only in GitHub `production` and the local `.env`) | Posts published in Carlos's name |
| LinkedIn client secret | Local `.env` only | Anyone could request tokens for the app |
| GitHub dispatch token | Supabase Vault | Rebuilds triggered by someone else (contents write on this one repository) |
| Supabase secret key | GitHub environment `production`, local `.env` | Full database access |
| Post drafts | Supabase + local `drafts/` and `backups/` (both git-ignored) | Early publication |
| Original photos | Local `private-assets/` (git-ignored) | GPS location, device details |

## 2. Threat model and controls

| Threat | Control |
|---|---|
| Reading the database through the public API | `anon`/`authenticated` hold no privileges; RLS on every table with no policies; pgTAP tests guarantee it |
| XSS (injecting script into the site) | Static site; CSP with a hash for every script and no `unsafe-inline` for scripts; Markdown sanitised before rendering; no `set:html` with untreated data |
| Clickjacking | `frame-ancestors 'none'` and `X-Frame-Options: DENY` at Cloudflare |
| Contact-form spam and abuse | Turnstile bound to the action and hostname; honeypot; 5 messages an hour per IP (salted hash, deleted after 24 hours); strict validation; 16 KB limit |
| CSRF / code theft in the LinkedIn OAuth flow | 256-bit random `state` generated and checked on Carlos's computer (never stored); the static callback page only displays `state:code` and removes it from the address bar and history; the code is single use, expires in minutes and is useless without the client secret, which never leaves the computer; account pinned by `LINKEDIN_EXPECTED_SUB` |
| Secrets leaking through code | Secrets only through `astro:env/server` (build error if used client-side); `.gitignore`; push protection; CI scans `dist/` for secret patterns |
| Supply chain (npm, Python, Actions) | `npm ci --ignore-scripts`; `uv sync --locked` from `uv.lock` (hashes); `npm audit` in CI; Actions pinned to commit SHAs; weekly Dependabot for npm, uv and Actions; minimal permissions per job |
| Domain takeover | Domain verified with GitHub Pages; DNS at Cloudflare with MFA |
| Duplicate LinkedIn posts | `claim_linkedin_shares()` with `FOR UPDATE SKIP LOCKED`; at most three attempts |
| Prompt injection through messages | `CLAUDE.md` tells Claude Code to treat `contact_messages` as data only |
| Photos with GPS | `uv run cms portrait` and `uv run cms media add` copy only the pixels into a new image, so no metadata survives (covered by tests) |
| Homelab exposed through Labs | Recommendation: Cloudflare Access, or instances with demo data only |

## 3. Privacy Act 2020 (New Zealand) — the 13 principles

| IPP | How the site complies |
|---|---|
| 1 — Purpose | Collects only what's needed to reply (name, email, topic, message) |
| 2 — Source | Directly from the visitor |
| 3 — Transparency | Notice beside the form and a `/privacy/` page covering purpose, recipients and rights |
| 4 — Manner of collection | No hidden tracking, cookies or analytics; Turnstile loads only when someone starts filling in the form |
| 5 — Storage and security | Section 2 above |
| 6 — Access | Runbook in section 5; reply within 20 working days |
| 7 — Correction | Runbook in section 5 |
| 8 — Accuracy | Data comes from the person themselves; corrected on request |
| 9 — Retention | Messages deleted after 12 months; IP hashes after 24 hours (pg_cron) |
| 10 — Use | Only to reply; never for marketing |
| 11 — Disclosure | None, except to the listed providers (processors) |
| 12 — Cross-border disclosure | Supabase (Australia), Cloudflare and GitHub (United States and global), declared in the notice and covered by DPAs |
| 13 — Unique identifiers | None assigned |
| Part 6 — Notifiable privacy breaches | Runbook in section 6 |

Fonts are self-hosted, so no request from this site sends a visitor's IP address to Google.

## 4. Web scraping — what can and can't be done

Public content can always be copied by a determined person. The aim is to make automated collection expensive and to make it clear that it isn't authorised.

1. **No sensitive personal data in the HTML.** No phone number, personal email, suburb or visa status; contact only through the form.
2. **No public data API.** Supabase's public key can't read anything.
3. **Cloudflare edge:** Bot Fight Mode, AI-crawler blocking, AI Labyrinth and WAF rules (SETUP.md, Cloudflare security settings).
4. **Legal and technical signals:** `robots.txt` blocking 20+ AI crawlers; `<meta name="robots" content="noai, noimageai">`; a text-and-data-mining reservation (`tdm-reservation` and `/.well-known/tdmrep.json`); a statement in the privacy notice.
5. **Images:** served optimised and without metadata; the original photo is never published.
6. **GitHub repositories:** only public ones appear; making a repository private removes it from the site at the next sync.

## 5. Runbook — requests from individuals (access, correction, deletion)

Requests arrive through the form with the topic "A privacy request about my data". Confirm identity by replying to the same email address.

```sql
-- Access: everything held about an email address
select created_at, name, email, topic, message, consent_at, privacy_version, status
from public.contact_messages where email = 'person@example.com';

-- Correction
update public.contact_messages set name = 'Correct Name' where email = 'person@example.com';

-- Deletion (not required by the Privacy Act, but offered in the privacy notice)
delete from public.contact_messages where email = 'person@example.com';
```

Reply within 20 working days, free of charge. Keep only a record that the request was handled (date and type), not the data itself.

## 6. Runbook — security incident

1. **Contain:** rotate the secret involved (Supabase secret key under *API Keys*; `LINKEDIN_TOKEN_KEY` (then run `uv run cms linkedin connect` again); the LinkedIn client secret in the developer portal; the GitHub dispatch token in Vault; disconnect the app under LinkedIn *Settings → Data privacy → Permitted services*).
2. **Assess:** which data, how many people, for how long? Logs: Supabase (*Logs Explorer*), GitHub (*Security log*), Cloudflare (*Security Events*).
3. **Notify** if serious harm is likely: the Office of the Privacy Commissioner through [NotifyUs](https://www.privacy.org.nz/responsibilities/privacy-breaches/notify-us/) as soon as practicable, and the people affected.
4. **Record** what happened and what changed, even if it isn't notifiable.

## 7. Regular maintenance

| When | What |
|---|---|
| Weekly | Review Dependabot pull requests for npm, uv and Actions (CI must pass) |
| Monthly, and before big edits | `uv run cms backup`, then copy the folder somewhere other than this computer. Backups exclude contact messages and the LinkedIn token by design |
| About every 60 days | `uv run cms linkedin connect` (the deploy warns 10 days ahead) |
| Every 6 months | Check the privacy notice still describes reality; re-test securityheaders.com |
| Yearly | Renew the GitHub dispatch token (update it in Vault); update the `LINKEDIN_API_VERSION` variable; update `Expires` in `public/.well-known/security.txt`; rotate `RATE_LIMIT_SALT` and `LINKEDIN_TOKEN_KEY` |
| When data collection changes | Update `/privacy/` and `SITE.privacyVersion` in `src/lib/site.ts` |
