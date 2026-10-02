// HTTP helpers shared by every Edge Function.

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function env(name: string, required = true): string {
  const value = Deno.env.get(name);
  if (required && !value) throw new Error(`Missing required secret: ${name}`);
  return value ?? '';
}

export function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://carlos.nz').split(',').map((s) => s.trim()).filter(Boolean);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extra } });
}

export function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** Reads a JSON body with a hard size cap (bytes). */
export async function readJson<T>(req: Request, maxBytes: number): Promise<T | null> {
  const length = Number(req.headers.get('content-length') ?? '0');
  if (length > maxBytes) return null;
  const raw = await req.text();
  if (raw.length > maxBytes) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
