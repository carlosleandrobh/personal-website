/**
 * Content access — runs ONLY at build time (static output).
 *
 * Source selection (CONTENT_SOURCE):
 *   - "supabase": read from Supabase with the server-side secret key. Required in CI.
 *   - "fixtures": read supabase/seed/content.json (local dev without credentials).
 *   - "auto" (default): Supabase if credentials exist, otherwise fixtures.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SECRET_KEY, CONTENT_SOURCE, INCLUDE_DRAFTS } from 'astro:env/server';
import fixtures from '../../supabase/seed/content.json';
import type {
  Certification, Education, Experience, GithubRepo, HomelabItem, Lab, NowItem, Post, Profile, SpectrumArea,
} from './types';

const hasCredentials = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
const source: 'supabase' | 'fixtures' =
  CONTENT_SOURCE === 'auto' ? (hasCredentials ? 'supabase' : 'fixtures') : CONTENT_SOURCE;

if (source === 'supabase' && !hasCredentials) {
  throw new Error('CONTENT_SOURCE=supabase but SUPABASE_URL / SUPABASE_SECRET_KEY are missing.');
}

// Drafts: only when explicitly requested, or in the local dev server with fixtures.
// A production build never shows drafts, whatever the content source.
const includeDrafts = INCLUDE_DRAFTS || (source === 'fixtures' && import.meta.env.DEV);

let client: SupabaseClient | undefined;
function db(): SupabaseClient {
  client ??= createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const contentSource = source;

// Memoise each query for the duration of the build.
const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key) as Promise<T>;
}

async function rows<T>(table: string, build: (q: any) => any, fixture: T[]): Promise<T[]> {
  if (source === 'fixtures') return fixture;
  const { data, error } = await build(db().from(table).select('*'));
  if (error) throw new Error(`Supabase query on "${table}" failed: ${error.message}`);
  return (data ?? []) as T[];
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export const getProfile = () =>
  once('profile', async (): Promise<Profile> => {
    if (source === 'fixtures') return fixtures.profile as Profile;
    const { data, error } = await db().from('profile').select('*').eq('id', 1).single();
    if (error) throw new Error(`Supabase profile query failed: ${error.message}`);
    return data as Profile;
  });

export const getSpectrum = () =>
  once('spectrum', async () =>
    (await rows<SpectrumArea>('spectrum_areas', (q) => q.eq('is_visible', true).order('position'),
      fixtures.spectrum_areas as SpectrumArea[])).sort(byPosition));

export const getNowItems = () =>
  once('now', async () =>
    (await rows<NowItem>('now_items', (q) => q.eq('is_visible', true).order('position'),
      fixtures.now_items as NowItem[])).sort(byPosition));

export const getCertifications = () =>
  once('certs', async () =>
    (await rows<Certification>('certifications', (q) => q.eq('is_visible', true).order('position'),
      fixtures.certifications as Certification[])).sort(byPosition));

export const getExperiences = () =>
  once('experiences', async () => {
    const list = await rows<Experience>('experiences', (q) => q.eq('is_visible', true),
      fixtures.experiences as Experience[]);
    // Current roles first, then most recent start date.
    return [...list].sort((a, b) =>
      (a.end_date === null ? 0 : 1) - (b.end_date === null ? 0 : 1) || b.start_date.localeCompare(a.start_date));
  });

export const getEducation = () =>
  once('education', async () => {
    const list = await rows<Education>('education', (q) => q.eq('is_visible', true),
      fixtures.education as Education[]);
    return [...list].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));
  });

export const getLabs = () =>
  once('labs', async () =>
    (await rows<Lab>('labs', (q) => q.eq('is_visible', true).order('position'),
      fixtures.labs as Lab[])).sort(byPosition));

export const getHomelab = () =>
  once('homelab', async () =>
    (await rows<HomelabItem>('homelab_items', (q) => q.eq('is_visible', true).order('position'),
      fixtures.homelab_items as HomelabItem[])).sort(byPosition));

export const getPosts = () =>
  once('posts', async () => {
    const now = Date.now();
    const list = await rows<Post>(
      'posts',
      (q) => (includeDrafts ? q.neq('status', 'archived') : q.eq('status', 'published').lte('published_at', new Date().toISOString())),
      fixtures.posts as Post[],
    );
    return list
      .filter((p) => includeDrafts ? p.status !== 'archived' : p.status === 'published' && p.published_at && Date.parse(p.published_at) <= now)
      .sort((a, b) => Date.parse(b.published_at ?? '0') - Date.parse(a.published_at ?? '0'));
  });

export const getRepos = () =>
  once('repos', async () => {
    const list = await rows<GithubRepo>('github_repos', (q) => q.eq('is_visible', true),
      fixtures.github_repos as GithubRepo[]);
    return [...list].sort((a, b) =>
      Number(b.featured) - Number(a.featured) || Date.parse(b.pushed_at ?? '0') - Date.parse(a.pushed_at ?? '0'));
  });
