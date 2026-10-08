/**
 * POST /functions/v1/contact
 *
 * The only public write path into the database. In order:
 *   1. CORS / Origin allow-list (only https://carlos.nz)
 *   2. Size-capped JSON body, strict field validation
 *   3. Honeypot (bots get a fake success)
 *   4. Rate limit per salted IP hash (the IP itself is never stored)
 *   5. Cloudflare Turnstile verification (action + hostname bound)
 *   6. Insert the message (data minimisation: no IP, no user agent)
 *   7. Optional emails via Resend: the submission to Carlos, and a confirmation to the visitor
 */
import { adminClient } from '../_shared/db.ts';
import { corsHeaders, env, json, readJson } from '../_shared/http.ts';
import { sha256Hex } from '../_shared/security.ts';

const TOPICS = new Set(['project', 'job', 'cv', 'collaboration', 'privacy', 'other']);
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,252}\.[A-Za-z]{2,63}$/;
const RATE_WINDOW = '1 hour';
const RATE_MAX = 5;

interface Payload {
  name?: unknown;
  email?: unknown;
  topic?: unknown;
  message?: unknown;
  consent?: unknown;
  privacy_version?: unknown;
  company_website?: unknown;
  turnstile_token?: unknown;
}

const str = (v: unknown) => (typeof v === 'string' ? v.normalize('NFC').trim() : '');
// Strip control characters except newlines/tabs in the message (intentional control-char regex).
// deno-lint-ignore no-control-regex
const clean = (v: string) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

function invalid(field: string, error: string, cors: Record<string, string>) {
  return json({ ok: false, field, error }, 400, cors);
}

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const form = new FormData();
  form.append('secret', env('TURNSTILE_SECRET_KEY'));
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  form.append('idempotency_key', crypto.randomUUID());
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  if (!res.ok) return false;
  const out = await res.json() as { success: boolean; action?: string; hostname?: string };
  const hosts = (Deno.env.get('TURNSTILE_HOSTNAMES') ?? 'carlos.nz').split(',').map((h) => h.trim());
  return out.success === true && out.action === 'contact' && !!out.hostname && hosts.includes(out.hostname);
}

const TOPIC_LABELS: Record<string, string> = {
  project: 'A project or piece of work',
  job: 'A job opportunity',
  cv: 'Requesting my CV',
  collaboration: 'A collaboration',
  privacy: 'A privacy request about my data',
  other: 'Something else',
};

async function sendEmail(apiKey: string, mail: Record<string, unknown>) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mail),
  }).catch(() => undefined);
}

/**
 * Two plain-text emails via Resend, both best-effort (a failure never loses the message, which is already stored):
 *   1. to Carlos: what the visitor submitted, with Reply-To set to the visitor
 *   2. to the visitor: a short confirmation that the message arrived
 * Name, topic and message only ever appear in the body, never in a subject or header, so they can't inject headers.
 */
async function notify(m: { name: string; email: string; topic: string; message: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('NOTIFY_EMAIL_TO');
  const from = Deno.env.get('NOTIFY_EMAIL_FROM');
  if (!apiKey || !to || !from) return;
  const topicLabel = TOPIC_LABELS[m.topic] ?? m.topic;

  await Promise.all([
    sendEmail(apiKey, {
      from,
      to: [to],
      reply_to: m.email,
      subject: `New message on carlos.nz (${m.topic})`,
      text: `Name: ${m.name}\nEmail: ${m.email}\nTopic: ${topicLabel}\n\n${m.message}\n`,
    }),
    sendEmail(apiKey, {
      from,
      to: [m.email],
      subject: 'Thanks for your message',
      text: `Hi ${m.name},\n\n` +
        `Thanks for getting in touch. Your message has arrived and I'll reply as soon as I can.\n\n` +
        `Topic: ${topicLabel}\n\n` +
        `Your message:\n${m.message}\n\n` +
        `Carlos\ncarlos.nz\n\n` +
        `You are getting this one-off email because you used the contact form on carlos.nz. ` +
        `I only use your details to reply to you; see https://carlos.nz/privacy/ for how they are handled.`,
    }),
  ]);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: Object.keys(cors).length ? 204 : 403, headers: cors });
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405, { Allow: 'POST, OPTIONS' });
  if (!Object.keys(cors).length) return json({ ok: false, error: 'Origin not allowed' }, 403);
  if (!(req.headers.get('content-type') ?? '').startsWith('application/json')) {
    return json({ ok: false, error: 'Expected application/json' }, 415, cors);
  }

  const body = await readJson<Payload>(req, 16_384);
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'Invalid request body' }, 400, cors);

  // Honeypot: pretend it worked, store nothing.
  if (str(body.company_website)) return json({ ok: true }, 201, cors);

  const name = clean(str(body.name));
  const email = str(body.email).toLowerCase();
  const topic = str(body.topic) || 'other';
  const message = clean(str(body.message));
  const privacyVersion = str(body.privacy_version);
  const token = str(body.turnstile_token);

  if (name.length < 1 || name.length > 120) return invalid('name', 'Enter your name (up to 120 characters).', cors);
  if (email.length > 254 || !EMAIL.test(email)) return invalid('email', 'Enter a valid email address.', cors);
  if (!TOPICS.has(topic)) return invalid('topic', 'Choose a topic from the list.', cors);
  if (message.length < 10 || message.length > 5000) {
    return invalid('message', 'Write a message between 10 and 5,000 characters.', cors);
  }
  if (body.consent !== true) return invalid('consent', 'Tick the consent box so I can reply to you.', cors);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(privacyVersion)) return invalid('consent', 'Reload the page and try again.', cors);
  if (!token || token.length > 2048) return invalid('turnstile', 'Complete the spam check and try again.', cors);

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null;
  const db = adminClient();

  try {
    const ipHash = await sha256Hex(`${env('RATE_LIMIT_SALT')}:${ip ?? 'unknown'}`);
    const { data: limited, error: rlError } = await db.rpc('contact_rate_limit_hit', {
      p_ip_hash: ipHash,
      p_window: RATE_WINDOW,
      p_max: RATE_MAX,
    });
    if (rlError) throw new Error(`rate-limit: ${rlError.code}`);
    if (limited) {
      return json({ ok: false, error: 'Too many messages. Try again later.' }, 429, { ...cors, 'Retry-After': '3600' });
    }

    if (!(await verifyTurnstile(token, ip))) {
      return invalid('turnstile', 'The spam check failed. Reload the page and try again.', cors);
    }

    const { error } = await db.from('contact_messages').insert({
      name,
      email,
      topic,
      message,
      consent_at: new Date().toISOString(),
      privacy_version: privacyVersion,
    });
    if (error) throw new Error(`insert: ${error.code}`);

    await notify({ name, email, topic, message });
    return json({ ok: true }, 201, cors);
  } catch (err) {
    // Log the failure class only — never the visitor's details.
    console.error('contact failed', err instanceof Error ? err.message : 'unknown');
    return json({ ok: false, error: 'Something went wrong on my side. Try again in a few minutes.' }, 500, cors);
  }
});
