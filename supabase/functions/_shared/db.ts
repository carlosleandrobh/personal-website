import { createClient, type SupabaseClient } from './deps.ts';

let client: SupabaseClient | undefined;

/** Server-side client with the service key. Never expose its responses unfiltered. */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase server credentials are not available to the function');
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
