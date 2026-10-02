// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;
const contactEndpoint = env.PUBLIC_CONTACT_ENDPOINT || process.env.PUBLIC_CONTACT_ENDPOINT || '';
// The only origin the browser may call: the contact Edge Function.
const functionsOrigin = contactEndpoint ? new URL(contactEndpoint).origin : supabaseHost ? `https://${supabaseHost}` : '';

// Content-Security-Policy. Astro hashes every script/style it emits and writes
// the policy into a <meta> tag on each page. Headers that a <meta> tag cannot
// carry (frame-ancestors, HSTS, etc.) are set at the Cloudflare edge — see
// docs/SECURITY-AND-PRIVACY.md.
const TURNSTILE = 'https://challenges.cloudflare.com';

export default defineConfig({
  site: 'https://carlos.nz',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  prefetch: false,
  // Post bodies are rendered by src/lib/markdown.ts; Astro's own Markdown pipeline is unused.
  markdown: { syntaxHighlight: false },
  integrations: [
    sitemap({ filter: (page) => !/\/(og|linkedin)\/|\/404/.test(page) }),
    icon({ iconDir: 'src/icons' }),
  ],
  image: {
    // Post covers uploaded to Supabase Storage are downloaded and optimised at
    // build time, then served from carlos.nz (visitors never hit Supabase).
    remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost }] : [],
  },
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "img-src 'self' data:",
        "font-src 'self'",
        /** @type {`connect-src${string}`} */ (`connect-src 'self'${functionsOrigin ? ` ${functionsOrigin}` : ''}`),
        `frame-src ${TURNSTILE}`,
        "form-action 'self'",
        "manifest-src 'self'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: { resources: ["'self'", TURNSTILE] },
      // Syntax-highlighted code blocks use inline style attributes (colours).
      // Only *attributes* are allowed inline; <style> elements still need a hash.
      styleDirective: { resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }] },
    },
  },
  env: {
    validateSecrets: true,
    schema: {
      // Server-only (build time). Never shipped to the browser — importing them
      // from client code is a build error.
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      SUPABASE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONTENT_SOURCE: envField.enum({ context: 'server', access: 'public', values: ['supabase', 'fixtures', 'auto'], default: 'auto' }),
      INCLUDE_DRAFTS: envField.boolean({ context: 'server', access: 'public', default: false }),
      // Public by design (they end up in the HTML).
      PUBLIC_CONTACT_ENDPOINT: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    build: { assetsInlineLimit: 0 },
  },
});
