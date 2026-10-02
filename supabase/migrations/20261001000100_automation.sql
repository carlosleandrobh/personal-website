-- =============================================================================
-- carlos.nz — automation
--   1. Content change  -> GitHub repository_dispatch (via pg_net) -> Actions rebuild + deploy
--   2. Data retention  -> pg_cron jobs (privacy: keep personal data only as long as needed)
--
-- Prerequisites (one-time, run in the SQL editor — values are NOT stored in Git):
--   select vault.create_secret('YOUR-USERNAME/carlos-nz', 'github_repository');
--   select vault.create_secret('<fine-grained token: Contents read & write, this repo only>', 'github_dispatch_token');
-- =============================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- 1. Rebuild requests
-- -----------------------------------------------------------------------------
create or replace function private.dispatch_rebuild(p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  repo  text;
  token text;
begin
  select decrypted_secret into repo  from vault.decrypted_secrets where name = 'github_repository';
  select decrypted_secret into token from vault.decrypted_secrets where name = 'github_dispatch_token';

  if repo is null or token is null or repo !~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' then
    raise warning 'carlos.nz: GitHub secrets missing or invalid in Vault; skipping rebuild request';
    return;
  end if;

  perform net.http_post(
    url     := 'https://api.github.com/repos/' || repo || '/dispatches',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || token,
                 'Accept', 'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'User-Agent', 'carlos-nz-database',
                 'Content-Type', 'application/json'),
    body    := jsonb_build_object('event_type', 'content-updated',
                                  'client_payload', jsonb_build_object('source', left(p_source, 60))),
    timeout_milliseconds := 5000
  );
end;
$$;

-- Statement-level trigger: one request per statement, not per row.
-- github_repos, contact_messages and linkedin_* are intentionally excluded:
-- they change during the build/share jobs and would cause rebuild loops.
create or replace function private.request_site_rebuild()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.dispatch_rebuild(tg_table_name);
  return null;
end;
$$;

-- `uv run cms rebuild` calls this with the secret key.
create or replace function public.request_rebuild(p_source text default 'manual')
returns void
language sql
security definer
set search_path = ''
as $$ select private.dispatch_rebuild(p_source); $$;

revoke all on function private.dispatch_rebuild(text) from public, anon, authenticated;
revoke all on function private.request_site_rebuild() from public, anon, authenticated;
revoke all on function public.request_rebuild(text) from public, anon, authenticated;
grant execute on function private.dispatch_rebuild(text) to service_role;
grant execute on function private.request_site_rebuild() to service_role;
grant execute on function public.request_rebuild(text) to service_role;

do $$
declare
  t text;
begin
  foreach t in array array['profile','spectrum_areas','now_items','certifications','experiences',
                           'education','labs','homelab_items','posts']
  loop
    execute format(
      'create trigger request_site_rebuild
         after insert or update or delete on public.%I
         for each statement execute function private.request_site_rebuild()', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Retention (NZ Privacy Act 2020 IPP 9 / GDPR art. 5(1)(e) storage limitation)
-- Adjust the intervals here AND in the privacy notice (src/pages/privacy.astro).
-- -----------------------------------------------------------------------------
select cron.schedule(
  'purge-contact-messages',
  '15 3 * * *',
  $$ delete from public.contact_messages where created_at < now() - interval '12 months' $$
);

select cron.schedule(
  'purge-contact-rate-limits',
  '*/30 * * * *',
  $$ delete from private.contact_rate_limits where created_at < now() - interval '24 hours' $$
);

select cron.schedule(
  'purge-net-http-responses',
  '30 3 * * *',
  $$ delete from net._http_response where created < now() - interval '7 days' $$
);
