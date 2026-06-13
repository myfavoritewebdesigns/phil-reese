/**
 * Cloudflare Pages Function — POST /api/contact
 *
 * Relays any site form tagged `data-pr-contact-form` (handled client-side in
 * src/scripts/contact-form.ts) to Phil's inbox via the Mailgun HTTP API.
 * Spam control mirrors Joe's Vintage Guitars: a hidden honeypot + hCaptcha
 * server-side verification, on top of this template's origin lock, payload
 * caps, field allowlist, and per-formId required-field rule.
 *
 * Required env vars (CF Pages → Settings → Environment variables, as secrets):
 *   MAILGUN_API_KEY    Mailgun private API key (the MFWD account key works for any
 *                      domain on that account — only MAILGUN_DOMAIN changes per site)
 *   MAILGUN_DOMAIN     Phil's sending domain, e.g. "mg.philsellsbiz.com"
 *   NOTIFY_TO_EMAIL    where leads land (e.g. phil@philsellsbiz.com)
 *   ALLOWED_ORIGIN     production origin "https://www.philsellsbiz.com" — REQUIRED
 *                      in production; the endpoint fails closed without it.
 *   ENVIRONMENT        "production" (enables fail-closed origin checks)
 * Optional:
 *   HCAPTCHA_SECRET    hCaptcha secret key. When set, every submission must carry a
 *                      valid `h-captcha-response` token. Unset (dev) → captcha skipped.
 *   MAILGUN_FROM       sender; defaults to "Phil Reese <noreply@<DOMAIN>>"
 *   MAILGUN_REGION     "us" (default) or "eu" — picks the Mailgun API host
 *   RATE_LIMIT_KV      KV binding for per-IP throttling (advisory only — see below)
 *
 * ⚠️ KV rate-limiting is advisory, not atomic. The real rate limit must be a
 * Cloudflare WAF rate-limit rule on /api/contact at the zone level.
 *
 * ⚠️ Any field in ALLOWED_FIELDS lands verbatim in the outbound email. Do not add
 * sensitive fields (SSN, card numbers) without redacting them from the body.
 */
import type { KVNamespace } from '@cloudflare/workers-types';

interface Env {
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
  NOTIFY_TO_EMAIL?: string;
  MAILGUN_FROM?: string;
  MAILGUN_REGION?: string;
  ALLOWED_ORIGIN?: string;
  HCAPTCHA_SECRET?: string;
  RATE_LIMIT_KV?: KVNamespace;
  ENVIRONMENT?: string;
}

type Ctx = { request: Request; env: Env };

// ---------- Config ----------
const MAX_PAYLOAD_BYTES = 50 * 1024;
const MAX_FIELD_LENGTH = 5000;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 5;

// Allowlist — Phil's live CF7 field names (your-*-bt + bst-way-bt) plus generic
// fallbacks and the client-added meta fields. Anything else is dropped.
const ALLOWED_FIELDS = new Set([
  'your-name-bt', 'your-email-bt', 'your-phone-bt', 'your-message-bt', 'bst-way-bt',
  'name', 'email', 'phone', 'message', 'subject', 'replyMethod',
  'formId', 'submittedAt',
]);

// Human-readable labels for the email body (raw field name → label).
const FIELD_LABELS: Record<string, string> = {
  'your-name-bt': 'Name',
  'your-email-bt': 'Email',
  'your-phone-bt': 'Phone',
  'your-message-bt': 'Message',
  'bst-way-bt': 'Best way to reply',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  message: 'Message',
  replyMethod: 'Best way to reply',
  subject: 'Subject',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Helpers ----------
function corsHeaders(allowOrigin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
}

function reject(allowOrigin: string, status: number, publicMessage: string): Response {
  return new Response(JSON.stringify({ ok: false, error: publicMessage }), {
    status,
    headers: corsHeaders(allowOrigin),
  });
}

function isProduction(env: Env): boolean {
  return (env.ENVIRONMENT ?? '').toLowerCase() === 'production';
}

/** Resolve the Access-Control-Allow-Origin to echo, and whether to accept at all. */
function checkOrigin(env: Env, reqOrigin: string | null): { accept: boolean; allowOrigin: string } {
  const expected = env.ALLOWED_ORIGIN ?? '';

  if (isProduction(env) && !expected) {
    console.error('[contact] FAIL CLOSED: ALLOWED_ORIGIN env var is required in production');
    return { accept: false, allowOrigin: 'null' };
  }
  if (reqOrigin === 'null') return { accept: false, allowOrigin: 'null' };
  if (reqOrigin === null || reqOrigin === '') {
    if (isProduction(env)) return { accept: false, allowOrigin: 'null' };
    return { accept: true, allowOrigin: expected || '*' };
  }
  if (expected && reqOrigin === expected) return { accept: true, allowOrigin: reqOrigin };
  return { accept: false, allowOrigin: 'null' };
}

/** Verify an hCaptcha token against hcaptcha siteverify (mirrors JVG). */
async function verifyHcaptcha(secret: string, token: string, ip: string | null): Promise<boolean> {
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (data.success !== true) console.warn('[contact] hcaptcha rejected:', (data['error-codes'] ?? []).join(', '));
    return data.success === true;
  } catch (err) {
    console.error('[contact] hcaptcha verify failed', err);
    return false;
  }
}

// Advisory only — see file header. Real rate-limit must be a CF WAF rule.
async function rateLimit(kv: KVNamespace | undefined, ip: string): Promise<boolean> {
  if (!kv) return true;
  const key = `rl:${ip}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= RATE_LIMIT_MAX_REQUESTS) return false;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  return true;
}

// ---------- Handlers ----------
export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  const reqOrigin = request.headers.get('Origin');
  const originCheck = checkOrigin(env, reqOrigin);
  const allowOrigin = originCheck.allowOrigin;
  if (!originCheck.accept) return reject(allowOrigin, 403, 'Origin not allowed');

  // Read body with a hard size cap (don't trust Content-Length — chunked bodies bypass it).
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return reject(allowOrigin, 400, 'Could not read body');
  }
  if (raw.length > MAX_PAYLOAD_BYTES) return reject(allowOrigin, 413, 'Payload too large');

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return reject(allowOrigin, 400, 'Invalid JSON');
  }

  // Honeypot — silently 200 so bots don't retry.
  const honeypot = payload['_honeypot'];
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    console.log('[contact] honeypot triggered, silently dropping');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders(allowOrigin) });
  }

  // hCaptcha — enforced whenever HCAPTCHA_SECRET is set; skipped (warn) in dev.
  if (env.HCAPTCHA_SECRET) {
    const token = String(payload['h-captcha-response'] ?? '');
    if (!token) return reject(allowOrigin, 400, 'Captcha is required');
    const ip = request.headers.get('CF-Connecting-IP');
    const ok = await verifyHcaptcha(env.HCAPTCHA_SECRET, token, ip);
    if (!ok) return reject(allowOrigin, 403, 'Captcha verification failed');
  } else {
    console.warn('[contact] HCAPTCHA_SECRET not set — skipping captcha verification');
  }

  // Advisory rate limit
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await rateLimit(env.RATE_LIMIT_KV, ip))) return reject(allowOrigin, 429, 'Too many requests');

  // Field allowlist + sanitization (CRLF stripped → no Mailgun header injection)
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const s = String(v).slice(0, MAX_FIELD_LENGTH).replace(/[\r\n]+/g, ' ').trim();
    if (s) clean[k] = s;
  }

  // Resolve the key fields whether the form used Phil's -bt names or generic ones.
  const name = clean['your-name-bt'] ?? clean.name ?? '';
  const email = clean['your-email-bt'] ?? clean.email ?? '';
  const phone = clean['your-phone-bt'] ?? clean.phone ?? '';

  // Required: a name plus at least one way to reach them.
  if (!name || !(email || phone)) return reject(allowOrigin, 400, 'Missing required fields');
  if (email && !EMAIL_RE.test(email)) return reject(allowOrigin, 400, 'Invalid email format');

  const formId = clean.formId ?? 'website';

  // Mailgun send (stub-success when unconfigured so dev/preview can test the pipe).
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    console.log('[contact] Mailgun not configured. Payload:', clean);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders(allowOrigin) });
  }

  // Build a readable body with friendly labels (skip meta + captcha fields).
  const skip = new Set(['formId', 'submittedAt']);
  const lines = Object.entries(clean)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${v}`);
  const text = [
    `New ${formId} submission from philsellsbiz.com`,
    '',
    ...lines,
    '',
    `Submitted: ${clean.submittedAt ?? ''}`,
  ].join('\n');

  const region = (env.MAILGUN_REGION ?? 'us').toLowerCase();
  const host = region === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
  const from = env.MAILGUN_FROM ?? `Phil Reese <noreply@${env.MAILGUN_DOMAIN}>`;

  try {
    const form = new FormData();
    form.set('from', from);
    form.set('to', env.NOTIFY_TO_EMAIL ?? `admin@${env.MAILGUN_DOMAIN}`);
    form.set('subject', `Website lead: ${formId}${name ? ` — ${name}` : ''}`);
    form.set('text', text);
    if (email) form.set('h:Reply-To', email);

    const res = await fetch(`https://${host}/v3/${env.MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`api:${env.MAILGUN_API_KEY}`) },
      body: form,
    });
    if (!res.ok) {
      console.error('[contact] Mailgun rejected:', res.status, await res.text());
      return reject(allowOrigin, 502, 'Delivery failed');
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders(allowOrigin) });
  } catch (err) {
    console.error('[contact] send error:', err);
    return reject(allowOrigin, 500, 'Internal error');
  }
};

export const onRequestOptions = async ({ request, env }: Ctx): Promise<Response> => {
  const reqOrigin = request.headers.get('Origin');
  const originCheck = checkOrigin(env, reqOrigin);
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': originCheck.accept ? originCheck.allowOrigin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    },
  });
};
