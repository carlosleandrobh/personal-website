-- Run with: supabase test db   (local stack: supabase start)
-- Guards the core security property: client roles can't read or write anything.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- No GitHub secrets in this transaction, so request_rebuild must say so instead of failing silently.
delete from vault.secrets where name in ('github_repository', 'github_dispatch_token');

select ok((select bool_and(rowsecurity) from pg_tables where schemaname = 'public'), 'RLS is enabled on every public table');
select is((select count(*)::int from information_schema.role_table_grants
           where grantee in ('anon', 'authenticated') and table_schema = 'public'), 0, 'anon/authenticated have no table grants');

set local role anon;
select throws_ok('select count(*) from public.posts', '42501', null, 'anon cannot read posts (not even published ones)');
select throws_ok($$insert into public.contact_messages (name, email, message, consent_at, privacy_version)
                   values ('a', 'a@b.co', 'hello world!', now(), 'x')$$, '42501', null, 'anon cannot insert contact messages directly');
select throws_ok('select * from public.linkedin_credentials', '42501', null, 'anon cannot read the LinkedIn credentials');
select throws_ok($$select public.contact_rate_limit_hit('x', '1 hour', 5)$$, '42501', null, 'anon cannot call the rate-limit RPC');
select throws_ok('select * from public.claim_linkedin_shares(1)', '42501', null, 'anon cannot claim LinkedIn shares');
select throws_ok('select public.request_rebuild(''x'')', '42501', null, 'anon cannot request a rebuild');
select throws_ok('select * from public.rebuild_result(1)', '42501', null, 'anon cannot read the rebuild results');
reset role;

set local role service_role;
select throws_ok('select public.request_rebuild(''x'')', 'P0001', null, 'request_rebuild reports missing GitHub secrets');
select is((select count(*)::int from public.rebuild_result(-1)), 0, 'rebuild_result has no rows for an unknown request');
select lives_ok($$insert into public.labs (name, url) values ('Tāmaki Makaurau Lab', 'https://example.com')$$, 'the secret key can add a lab with just name + url');
select is((select slug from public.labs where name = 'Tāmaki Makaurau Lab'), 'tamaki-makaurau-lab', 'lab slug is generated automatically (macrons removed)');
select throws_ok($$insert into public.labs (name, url) values ('Insecure', 'http://example.com')$$, '23514', null, 'lab links must use https');
reset role;

select * from finish();
rollback;
