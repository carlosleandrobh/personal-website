-- The language of a company or institution name, when it is not English (for example 'pt-BR' for Drogaria Araujo).
-- The site wraps the name in <span lang="…"> so screen readers pronounce it in that language. Nothing visible changes.
-- Null means the name is read in the page language (en-NZ).
-- Additive only: existing grants and RLS (no access for anon/authenticated) are unchanged.
alter table public.experiences
  add column company_lang text check (company_lang is null or company_lang ~ '^[a-z]{2,3}(-[A-Z]{2})?$');

alter table public.education
  add column institution_lang text check (institution_lang is null or institution_lang ~ '^[a-z]{2,3}(-[A-Z]{2})?$');
