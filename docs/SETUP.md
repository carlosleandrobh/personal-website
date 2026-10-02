# Set-up — from zero to carlos.nz

Two stages. **Stage 1** puts the site live in about 30 minutes using only GitHub Pages and Cloudflare DNS. **Stage 2** adds the database, contact form and LinkedIn sharing; the deploy workflow switches over automatically once the secrets exist. Day-to-day operations use the Python CLI (`uv run cms`).

Generate secrets with `openssl rand -base64 48` (on Windows, use Git Bash or WSL).

## 0. Before you start

- Node.js 22+, Git, VS Code (suggested extensions in `.vscode/extensions.json`)
- [uv](https://docs.astral.sh/uv/getting-started/installation/) for the Python CLI. Run `uv sync` once in the project folder; after that, every command is `uv run cms …`
- Accounts: GitHub, Cloudflare (where the domain is registered); for stage 2, Supabase and LinkedIn
- **Turn on multi-factor authentication** for GitHub, Cloudflare, Supabase and LinkedIn. It is the single most important defence here.

---

# Stage 1 — the static site

## 1. GitHub repository

1. Create a **public** repository called `carlos-nz`. GitHub Pages on a free account needs a public repository; that's why `.env`, `drafts/` and `private-assets/` are git-ignored.
2. Push the code:
   ```bash
   git init && git add -A && git commit -m "carlos.nz: initial site"
   git branch -M main && git remote add origin git@github.com:YOUR-USERNAME/carlos-nz.git && git push -u origin main
   ```
3. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
4. **Settings → Actions → General → Workflow permissions:** choose "Read repository contents" and untick "Allow GitHub Actions to create and approve pull requests".
5. **Settings → Code security:** turn on Dependabot alerts and security updates, secret scanning with **push protection**, and code scanning (CodeQL, "Default setup").
6. **Settings → Rules → Rulesets** (recommended): protect `main` from force pushes and deletion, and require the `CI` check.
7. **Verify the domain** so nobody can claim `carlos.nz` from another repository: in your profile, **Settings → Pages → Add a domain → carlos.nz**, then create the TXT record GitHub shows you (`_github-pages-challenge-YOUR-USERNAME`) in Cloudflare.

## 2. Cloudflare DNS

Start with the cloud **grey** ("DNS only"):

| Type | Name | Content |
|---|---|---|
| A | `@` | `185.199.108.153` · `185.199.109.153` · `185.199.110.153` · `185.199.111.153` (four records) |
| AAAA | `@` | `2606:50c0:8000::153` · `2606:50c0:8001::153` · `2606:50c0:8002::153` · `2606:50c0:8003::153` |
| CNAME | `www` | `YOUR-USERNAME.github.io` |

In GitHub, **Settings → Pages → Custom domain: `carlos.nz`**. Wait for the certificate, then tick **Enforce HTTPS**. Only then switch the records to the **orange** cloud (proxied). Section 8 covers the Cloudflare security settings.

## 3. First deploy

**Actions → Deploy → Run workflow.** The run will show the warning "Supabase secrets not set — building from supabase/seed/content.json (stage 1)". That's expected. The site is live at `https://carlos.nz` with your CV content; posts stay hidden until they are published, and the contact form shows "being set up" with a link to LinkedIn.

To change text during stage 1, edit `supabase/seed/content.json` (or any `.astro` page) in VS Code, then commit and push.

---

# Stage 2 — database, contact form and LinkedIn

## 4. GitHub token for rebuilds

The database asks GitHub Actions to rebuild whenever content changes. It needs a token that can do exactly that and nothing else.

**GitHub → Settings → Developer settings → Fine-grained tokens → Generate:**
- Repository access: **Only select repositories → carlos-nz**
- Permissions: **Contents: Read and write** (required by `repository_dispatch`), nothing else
- Expiry: 1 year (put a renewal reminder in your calendar)

## 5. Supabase

1. Create the project in the **Sydney (ap-southeast-2)** region, the closest to Auckland and the one named in the privacy notice. Use a strong database password and keep it in your password manager.
2. **Authentication → Sign In / Providers:** turn off new sign-ups. The site doesn't use logins, so this removes attack surface.
3. Apply the schema:
   ```bash
   npx supabase@latest login
   npx supabase@latest link --project-ref YOUR-PROJECT-REF
   npx supabase@latest db push
   ```
4. In the **SQL Editor**, store the GitHub details in Vault (they stay out of Git):
   ```sql
   select vault.create_secret('YOUR-USERNAME/carlos-nz', 'github_repository');
   select vault.create_secret('github_pat_…the token from step 4…', 'github_dispatch_token');
   ```
5. Create your local `.env` from `.env.example` with `SUPABASE_URL` and the **secret key** (Project Settings → API Keys → `sb_secret_…`), then load the content:
   ```bash
   uv run cms seed
   ```
   If you edited `supabase/seed/content.json` during stage 1, those edits are what gets loaded. From now on, Supabase is the source of truth: edit with `uv run cms content pull` / `content push`.
6. Check the rebuild link: `uv run cms rebuild`, then look for a new run in GitHub **Actions**.
7. Optional: run the security tests on the local stack with `npx supabase start && npx supabase test db`.

## 6. Contact form (Turnstile + Edge Function)

1. **Cloudflare → Turnstile → Add widget:** hostname `carlos.nz`, mode **Managed**. Keep the *site key* (it goes to GitHub, step 8) and the *secret key*.
2. Copy `supabase/functions.env.example` to `supabase/.env.functions`, fill in `TURNSTILE_SECRET_KEY` and a new `RATE_LIMIT_SALT`, then:
   ```bash
   npx supabase@latest secrets set --env-file supabase/.env.functions
   npx supabase@latest functions deploy contact
   ```

## 7. LinkedIn

1. LinkedIn requires a **Page** to be associated with the app. Use the SETHOS page or create a simple one for carlos.nz.
2. At **linkedin.com/developers → Create app**, open the **Products** tab and add **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect** (approved immediately, no review).
3. In the **Auth** tab, under "Authorized redirect URLs" (LinkedIn's label), add `https://carlos.nz/linkedin/callback/`. Stage 1 must be live, because this page is part of the site.
4. In your local `.env`: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` (it stays on your computer only) and a new `LINKEDIN_TOKEN_KEY` (`openssl rand -base64 32`).
5. Run `uv run cms linkedin connect`. Approve in the browser; the carlos.nz page shows a connection code; paste it into the terminal. The command then tells you the value for `LINKEDIN_EXPECTED_SUB`: add it to `.env` so no other account can ever be connected.
6. The token lasts about 60 days. The deploy warns 10 days before it expires; just run `uv run cms linkedin connect` again.

## 8. GitHub secrets and variables

**Settings → Environments → New environment `production`** → *Deployment branches and tags: Selected → `main`*. Secrets in this environment are only available to builds of the main branch.

| Type | Name | Value |
|---|---|---|
| Secret (environment `production`) | `SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` |
| Secret (environment `production`) | `SUPABASE_SECRET_KEY` | `sb_secret_…` |
| Secret (environment `production`) | `LINKEDIN_TOKEN_KEY` | the same value as in your `.env` (decrypts the stored LinkedIn token) |
| Secret (repository) | `PRIVATE_DATA_PATTERNS` | a regex of data that must never appear on the site, e.g. your phone number, personal email and suburb separated by `\|`. CI fails if any of them shows up. |
| Variable (repository) | `PUBLIC_CONTACT_ENDPOINT` | `https://YOUR-PROJECT-REF.supabase.co/functions/v1/contact` |
| Variable (repository) | `PUBLIC_TURNSTILE_SITE_KEY` | the Turnstile site key |
| Variable (repository) | `GH_USERNAME` | your GitHub username (for the repository sync) |
| Variable (repository) | `LINKEDIN_API_VERSION` | a recent version in `YYYYMM` form, e.g. `202608` (update about once a year) |

The LinkedIn client secret is deliberately **not** in GitHub: it's only needed on your computer, when connecting.

Then **Actions → Deploy → Run workflow**. The run now says "Building from Supabase".

---

# Cloudflare security settings (do these in stage 1)

### SSL/TLS
- Mode **Full (strict)** · Always Use HTTPS **on** · Minimum TLS **1.2** · TLS 1.3 **on**
- **HSTS:** turn it on only once everything works (max-age 6 months; *include subdomains* only if every homelab subdomain has HTTPS).
- If GitHub's certificate renewal ever fails, switch back to the grey cloud temporarily.

### Security headers (Rules → Transform Rules → Modify Response Header)
One rule for `http.host in {"carlos.nz" "www.carlos.nz"}`, using **Set static**:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `frame-ancestors 'none'; base-uri 'self'; object-src 'none'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

The full CSP, with a hash for every script, is already in each page's `<meta>` tag. The header above adds what a `<meta>` tag can't enforce, such as `frame-ancestors`.

### Bots and scraping (Security → Settings / Bots)
- **Bot Fight Mode:** on
- **AI bots / AI crawlers:** block AI training crawlers (the newer dashboard splits them into Search, Agent and Training; block at least *Training*)
- **AI Labyrinth:** on
- **Security → WAF → Custom rules** (the Free plan allows five): block scanner noise, for example
  `(http.request.uri.path contains "/wp-") or (http.request.uri.path contains ".php") or (http.request.uri.path contains "/.env") or (http.request.uri.path contains "/.git")` → **Block**

**Required test:** paste a post URL into the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/). If the preview fails because of bot blocking, add a *Skip* rule for the `LinkedInBot` user agent or turn off Bot Fight Mode.

### Optional
- **Email Routing:** `hello@carlos.nz` → your Gmail (a professional address without exposing your personal one).
- **Resend** for new-message notifications (the email contains no visitor data): verify the domain in Resend and fill in `RESEND_API_KEY`, `NOTIFY_EMAIL_TO` and `NOTIFY_EMAIL_FROM`. Then redeploy with `npx supabase@latest functions deploy contact`. If you turn it on, add Resend to the list of providers in `src/pages/privacy.astro`.

# Claude Code + Supabase MCP

In `.mcp.json`, replace `YOUR-PROJECT-REF`. The first time, Claude Code opens the Supabase sign-in (OAuth), so no key is stored in a file. The server is limited to this project. For read-only sessions, add `&read_only=true` to the URL.

# Final checklist

- [ ] `https://carlos.nz` loads with the padlock; `http://` and `www` redirect
- [ ] [securityheaders.com](https://securityheaders.com) and the [Mozilla Observatory](https://developer.mozilla.org/en-US/observatory) both give an A
- [ ] `https://carlos.nz/.well-known/security.txt` responds
- [ ] Stage 2: send a test message and read it with `uv run cms messages`
- [ ] Stage 2: publish a test post with `uv run cms post push … --publish` and watch the rebuild and LinkedIn share in **Actions**
- [ ] Accept the data processing agreements (DPAs) for Supabase, Cloudflare and GitHub in each account's settings
- [ ] Stage 2: take the first backup with `uv run cms backup` and test it with `uv run cms restore backups/<folder> --dry-run`
