-- =============================================================================
-- carlos.nz — initial schema
--
-- Security model (read this before changing anything):
--   * The public website is STATIC. Browsers never talk to the database.
--   * Content is read at build time (GitHub Actions) with the server-side
--     secret key, which bypasses RLS. Nothing else needs read access.
--   * Therefore the `anon` and `authenticated` roles get NO privileges at all.
--     RLS is enabled on every table with no policies (deny-by-default), and
--     table grants are revoked as a second layer. The public key is useless
--     for reading content -> there is no public data API to scrape.
--   * The only write from the outside world is the contact form, through the
--     `contact` Edge Function, which validates input and uses the secret key
--     server-side. Everything else is written by Carlos's CLI (`uv run cms`).
-- =============================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists citext with schema extensions;

-- Private schema: helper functions and internal tables. NOT exposed by the API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function private.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
           lower(extensions.unaccent(coalesce(value, ''))),
           '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Fills `slug` from `name`/`title` when it is left empty.
create or replace function private.ensure_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_text text;
begin
  if new.slug is null or btrim(new.slug) = '' then
    source_text := coalesce(to_jsonb(new) ->> 'title', to_jsonb(new) ->> 'name');
    new.slug := private.slugify(source_text);
  else
    new.slug := private.slugify(new.slug);
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.post_status as enum ('draft', 'published', 'archived');
create type public.lab_status as enum ('live', 'testing', 'archived');
create type public.cert_status as enum ('planned', 'studying', 'achieved');
create type public.message_status as enum ('new', 'read', 'replied', 'archived', 'spam');

-- -----------------------------------------------------------------------------
-- Profile (singleton row, id = 1)
-- -----------------------------------------------------------------------------
create table public.profile (
  id                 smallint primary key default 1 check (id = 1),
  display_name       text not null,
  full_name          text not null,
  greeting           text not null default 'Kia ora, I''m Carlos.',
  headline           text not null,
  subheadline        text not null,
  role_line          text not null,             -- short line used on OG images / author box
  location           text not null default 'Auckland, New Zealand',
  availability_text  text,                      -- e.g. 'Open to opportunities'
  is_available       boolean not null default true,
  years_experience   smallint not null default 15,
  about_md           text,
  linkedin_url       text check (linkedin_url is null or linkedin_url ~ '^https://(www\.)?linkedin\.com/'),
  github_username    text check (github_username is null or github_username ~ '^[A-Za-z0-9-]{1,39}$'),
  portrait_alt       text not null default 'Portrait of Carlos',
  updated_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Business <-> Technology spectrum (ordered from business to technology)
-- -----------------------------------------------------------------------------
create table public.spectrum_areas (
  id           bigint generated always as identity primary key,
  position     smallint not null,
  title        text not null,
  summary      text not null,
  icon         text not null default 'material-symbols:hub-outline',
  tags         text[] not null default '{}',
  is_visible   boolean not null default true,
  updated_at   timestamptz not null default now(),
  unique (position)
);

-- -----------------------------------------------------------------------------
-- "Now" block and certifications
-- -----------------------------------------------------------------------------
create table public.now_items (
  id           bigint generated always as identity primary key,
  position     smallint not null default 0,
  label        text not null,                 -- e.g. 'Studying', 'Building'
  title        text not null,
  description  text not null,
  icon         text not null default 'material-symbols:bolt-outline',
  status_text  text,                          -- e.g. 'In progress'
  meta_text    text,                          -- e.g. '2026 – 2027'
  is_visible   boolean not null default true,
  updated_at   timestamptz not null default now()
);

create table public.certifications (
  id              bigint generated always as identity primary key,
  position        smallint not null default 0,
  name            text not null,
  issuer          text,
  status          public.cert_status not null default 'planned',
  progress        smallint check (progress between 0 and 100),   -- null = don't show a bar
  target_label    text,                                          -- e.g. 'Target: 2027'
  credential_url  text check (credential_url is null or credential_url ~ '^https://'),
  is_visible      boolean not null default true,
  updated_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Experience & education
-- -----------------------------------------------------------------------------
create table public.experiences (
  id            bigint generated always as identity primary key,
  role          text not null,
  company       text not null,
  context       text,                     -- e.g. 'Placed at Northpower Limited'
  location      text,
  start_date    date not null,
  end_date      date,                     -- null = current
  summary       text not null,
  highlights    text[] not null default '{}',
  tags          text[] not null default '{}',
  is_visible    boolean not null default true,
  updated_at    timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table public.education (
  id            bigint generated always as identity primary key,
  degree        text not null,
  institution   text not null,
  location      text,
  start_date    date,
  end_date      date,
  in_progress   boolean not null default false,
  is_visible    boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Labs: experiments and tools available for testing.
-- Minimum to add one: name + url. Everything else is optional.
-- -----------------------------------------------------------------------------
create table public.labs (
  id             bigint generated always as identity primary key,
  slug           text not null unique,
  name           text not null,
  url            text not null check (url ~ '^https://'),
  summary        text,
  status         public.lab_status not null default 'testing',
  category       text not null default 'Self-hosted',
  tags           text[] not null default '{}',
  icon           text not null default 'material-symbols:science-outline',
  learned        text,                    -- "What I learned"
  notes_post_slug text,                   -- optional link to a post with notes
  repo_url       text check (repo_url is null or repo_url ~ '^https://'),
  started_on     date,
  featured       boolean not null default false,
  is_visible     boolean not null default true,
  position       smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.homelab_items (
  id           bigint generated always as identity primary key,
  position     smallint not null default 0,
  title        text not null,
  icon         text not null default 'material-symbols:dns-outline',
  lines        text[] not null default '{}',
  is_visible   boolean not null default true,
  updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Posts
-- -----------------------------------------------------------------------------
create table public.posts (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  title                text not null check (char_length(title) between 3 and 160),
  excerpt              text not null check (char_length(excerpt) between 10 and 320),
  body_md              text not null default '',
  category             text not null default 'Notes',
  tags                 text[] not null default '{}',
  cover_image_url      text check (cover_image_url is null or cover_image_url ~ '^(https://|/media/[A-Za-z0-9._-]+$)'),
  cover_alt            text,
  status               public.post_status not null default 'draft',
  published_at         timestamptz,
  share_to_linkedin    boolean not null default true,
  linkedin_commentary  text check (linkedin_commentary is null or char_length(linkedin_commentary) <= 2800),
  seo_description      text check (seo_description is null or char_length(seo_description) <= 200),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);

create index posts_published_idx on public.posts (published_at desc) where status = 'published';

-- One row per post that was (or is being) shared on LinkedIn.
-- Kept separate from `posts` so the share job never triggers a site rebuild.
create table public.linkedin_shares (
  post_id        uuid primary key references public.posts (id) on delete cascade,
  claimed_at     timestamptz not null default now(),
  shared_at      timestamptz,
  post_urn       text,
  last_error     text,
  attempts       smallint not null default 1
);

-- -----------------------------------------------------------------------------
-- GitHub repositories (synced, display-only; links go to GitHub)
-- -----------------------------------------------------------------------------
create table public.github_repos (
  id                bigint primary key,       -- GitHub repository id
  name              text not null,
  full_name         text not null,
  description       text,
  html_url          text not null check (html_url ~ '^https://github\.com/'),
  homepage          text,
  language          text,
  topics            text[] not null default '{}',
  stargazers_count  integer not null default 0,
  forks_count       integer not null default 0,
  pushed_at         timestamptz,
  -- Curation flags you control. The sync never overwrites these.
  is_visible        boolean not null default true,
  featured          boolean not null default false,
  synced_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Contact form (personal data — see docs/SECURITY-AND-PRIVACY.md)
-- -----------------------------------------------------------------------------
create table public.contact_messages (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 120),
  email             extensions.citext not null check (char_length(email) between 3 and 254),
  topic             text check (topic is null or char_length(topic) <= 60),
  message           text not null check (char_length(message) between 10 and 5000),
  consent_at        timestamptz not null,
  privacy_version   text not null,
  status            public.message_status not null default 'new',
  created_at        timestamptz not null default now()
);

create index contact_messages_created_idx on public.contact_messages (created_at);

-- Pseudonymous rate-limit ledger: salted SHA-256 of the IP, kept for 24h max.
create table private.contact_rate_limits (
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index contact_rate_limits_idx on private.contact_rate_limits (ip_hash, created_at);

-- LinkedIn credentials (singleton). The token is AES-256-GCM encrypted by the CLI
-- before it reaches the database; the key (LINKEDIN_TOKEN_KEY) is never stored here.
create table public.linkedin_credentials (
  id                 smallint primary key default 1 check (id = 1),
  member_urn         text not null,
  access_token_enc   text not null,
  scope              text,
  expires_at         timestamptz not null,
  updated_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['profile','spectrum_areas','now_items','certifications','experiences',
                           'education','labs','homelab_items','posts','linkedin_credentials']
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

create trigger ensure_slug before insert or update of slug, name on public.labs
  for each row execute function private.ensure_slug();
create trigger ensure_slug before insert or update of slug, title on public.posts
  for each row execute function private.ensure_slug();

-- Publishing a post without a date stamps it with "now".
create or replace function private.stamp_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger stamp_published_at before insert or update of status on public.posts
  for each row execute function private.stamp_published_at();

-- -----------------------------------------------------------------------------
-- Lockdown: RLS on everything, no policies, no grants for client roles.
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on table public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

alter table private.contact_rate_limits enable row level security;

revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

-- Future tables/functions created by the `postgres` role start locked down too.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- The service role (secret key) is used only server-side: build, CLI, Edge Functions.
-- It must be able to run the trigger helpers (slug, updated_at, published_at).
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;
grant execute on all functions in schema private to service_role;

-- Edge Functions use these RPCs to touch the private rate-limit table.
create or replace function public.contact_rate_limit_hit(p_ip_hash text, p_window interval, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  select count(*) into recent
    from private.contact_rate_limits
   where ip_hash = p_ip_hash and created_at > now() - p_window;
  if recent >= p_max then
    return true;
  end if;
  insert into private.contact_rate_limits (ip_hash) values (p_ip_hash);
  return false;
end;
$$;

revoke all on function public.contact_rate_limit_hit(text, interval, integer) from public, anon, authenticated;
grant execute on function public.contact_rate_limit_hit(text, interval, integer) to service_role;

-- Atomically claims posts that still need to go to LinkedIn, so two concurrent
-- runs can never share the same post twice. Only recent posts are eligible.
create or replace function public.claim_linkedin_shares(p_limit integer default 3)
returns table (id uuid, slug text, title text, excerpt text, seo_description text, linkedin_commentary text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with candidates as (
    select p.id
      from public.posts p
      left join public.linkedin_shares s on s.post_id = p.id
     where p.status = 'published'
       and p.share_to_linkedin
       and p.published_at <= now()
       and p.published_at > now() - interval '14 days'
       and (s.post_id is null
            or (s.shared_at is null and s.claimed_at < now() - interval '30 minutes' and s.attempts < 3))
     order by p.published_at
     limit p_limit
     for update of p skip locked
  ),
  claimed as (
    insert into public.linkedin_shares (post_id)
    select c.id from candidates c
    on conflict (post_id) do update
      set claimed_at = now(), attempts = public.linkedin_shares.attempts + 1
    returning post_id
  )
  select p.id, p.slug, p.title, p.excerpt, p.seo_description, p.linkedin_commentary
    from public.posts p
    join claimed c on c.post_id = p.id;
end;
$$;

revoke all on function public.claim_linkedin_shares(integer) from public, anon, authenticated;
grant execute on function public.claim_linkedin_shares(integer) to service_role;
