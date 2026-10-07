-- Optional link to the employer's website, shown on the experience timeline.
-- Additive only: existing grants and RLS (no access for anon/authenticated) are unchanged.
alter table public.experiences
  add column company_url text check (company_url is null or company_url ~ '^https://');
