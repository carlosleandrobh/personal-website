-- =============================================================================
-- carlos.nz — tell `cms rebuild` whether GitHub accepted the rebuild request
--
-- pg_net sends requests asynchronously, so the answer from GitHub lands in net._http_response a moment later.
--   * private.dispatch_rebuild now returns the pg_net request id (null when the Vault secrets are missing).
--   * public.request_rebuild returns that id, and raises an error when the secrets are missing.
--   * public.rebuild_result(id) returns GitHub's answer once it has arrived (no rows while still pending).
-- The content triggers keep calling dispatch_rebuild, so a bad token still never blocks a content save.
-- =============================================================================

drop function public.request_rebuild(text);
drop function private.dispatch_rebuild(text);

create function private.dispatch_rebuild(p_source text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  repo   text;
  token  text;
  req_id bigint;
begin
  select decrypted_secret into repo  from vault.decrypted_secrets where name = 'github_repository';
  select decrypted_secret into token from vault.decrypted_secrets where name = 'github_dispatch_token';

  if repo is null or token is null or repo !~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' then
    raise warning 'carlos.nz: GitHub secrets missing or invalid in Vault; skipping rebuild request';
    return null;
  end if;

  select net.http_post(
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
  ) into req_id;

  return req_id;
end;
$$;

-- `uv run cms rebuild` calls this with the secret key.
create function public.request_rebuild(p_source text default 'manual')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  req_id bigint;
begin
  req_id := private.dispatch_rebuild(p_source);
  if req_id is null then
    raise exception 'The GitHub secrets (github_repository, github_dispatch_token) are missing or invalid in Vault.';
  end if;
  return req_id;
end;
$$;

-- GitHub's answer to one request; no rows until it arrives. The body is trimmed and never contains our token.
create function public.rebuild_result(p_request_id bigint)
returns table (status_code integer, error_msg text, content text)
language sql
security definer
set search_path = ''
as $$
  select r.status_code, r.error_msg, left(r.content, 300)
  from net._http_response r
  where r.id = p_request_id;
$$;

revoke all on function private.dispatch_rebuild(text) from public, anon, authenticated;
revoke all on function public.request_rebuild(text) from public, anon, authenticated;
revoke all on function public.rebuild_result(bigint) from public, anon, authenticated;
grant execute on function private.dispatch_rebuild(text) to service_role;
grant execute on function public.request_rebuild(text) to service_role;
grant execute on function public.rebuild_result(bigint) to service_role;
