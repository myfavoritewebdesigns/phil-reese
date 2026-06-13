/**
 * Cloudflare Pages Function — POST /api/contact
 *
 * Hardened defaults. Required env vars (set in CF Pages dashboard):
 *   MAILGUN_API_KEY    — Mailgun API key
 *   MAILGUN_DOMAIN     — e.g. mg.example.com
 *   NOTIFY_TO_EMAIL    — where submissions are delivered
 *   ALLOWED_ORIGIN     — production origin (e.g. https://www.example.com).
 *                        REQUIRED in production — endpoint fails closed without it.
 *
 * Optional:
 *   TURNSTILE_SECRET_KEY  — enables Cloudflare Turnstile bot challenge
 *   RATE_LIMIT_KV         — KV namespace binding for per-IP throttling (advisory only)
 *
 * ⚠️ KV rate-limiting is advisory, not atomic. Concurrent submissions can race
 * through the get/put. The real rate limit must be a Cloudflare WAF rate-limit
 * rule on /api/contact at the account or zone level. KV here is defense-in-depth.
 *
 * ⚠️ Any field added to ALLOWED_FIELDS will appear verbatim in the outbound
 * email body. Do not add sensitive fields (SSN, card numbers, internal IDs)
 * without also redacting them from the email payload.
 */

/**
 * Note on types: we don't use `PagesFunction<Env>` from `@cloudflare/workers-types`
 * because that generic expects CF-flavored `Response` / `Headers` and conflicts
 * with the DOM types Astro's tsconfig already includes. The CF runtime accepts
 * standard DOM `Response` objects — the type wrapper is editor-help only.
 * Inline `{ request, env }` typing is sufficient and avoids the conflict.
 */
import type { KVNamespace } from '@cloudflare/workers-types';

interface Env {
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
  NOTIFY_TO_EMAIL?: string;
  ALLOWED_ORIGIN?: string;
  TURNSTILE_SECRET_KEY?: string;
  RATE_LIMIT_KV?: KVNamespace;
  // ENVIRONMENT — set to "production" or "preview". When "production", missing
  // ALLOWED_ORIGIN causes the endpoint to fail closed (500). In preview/dev,
  // a warning is logged but submissions are accepted from any same-origin POST.
  ENVIRONMENT?: string;
}

type Ctx = { request: Request; env: Env };

// ---------- Config ----------
const MAX_PAYLOAD_BYTES = 50 * 1024;
const MAX_FIELD_LENGTH = 5000;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 5;

const ALLOWED_FIELDS = new Set([
  'name', 'email', 'phone', 'message', 'subject',
  'replyMethod', 'comments', 'guitarType', 'howCanWeHelp',
  'formId', 'submittedAt',
]);

// Per-formId required field rule. At least one of the arrays in each tuple
// must be fully populated. Default: `name` + (`email` OR `phone`).
const REQUIRED_FIELDS: Record<string, string[][]> = {
  default: [['name', 'email'], ['name', 'phone']],
  // example: 'newsletter': [['email']],
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

/**
 * Resolve which Access-Control-Allow-Origin to send back, and whether to accept
 * the request at all. Returns `{ accept, allowOrigin }`.
 *
 * Rules:
 *   - Production + missing ALLOWED_ORIGIN → fail closed (accept=false).
 *   - Origin === ALLOWED_ORIGIN → accept, echo origin.
 *   - Origin === "null" (sandboxed iframe, file:// etc.) → reject explicitly.
 *   - Origin missing → accept only if not production AND endpoint is being
 *     called server-to-server (e.g. uptime monitor). In production this means
 *     a browser that didn't send Origin, which is suspicious.
 *   - Anything else → reject.
 */
function checkOrigin(env: Env, reqOrigin: string | null): { accept: boolean; allowOrigin: string } {
  const expected = env.ALLOWED_ORIGIN ?? '';

  if (isProduction(env) && !expected) {
    console.error('[contact] FAIL CLOSED: ALLOWED_ORIGIN env var is required in production');
    return { accept: false, allowOrigin: 'null' };
  }

  // Browser sent Origin: null explicitly — sandboxed/privacy context. Treat as untrusted.
  if (reqOrigin === 'null') {
    return { accept: false, allowOrigin: 'null' };
  }

  // Origin not sent at all — fine in dev/preview, suspicious in prod
  if (reqOrigin === null || reqOrigin === '') {
    if (isProduction(env)) return { accept: false, allowOrigin: 'null' };
    return { accept: true, allowOrigin: expected || '*' };
  }

  // Exact match (no port wildcarding — prod should pin exact origin)
  if (expected && reqOrigin === expected) {
    return { accept: true, allowOrigin: reqOrigin };
  }

  // Origin mismatched
  return { accept: false, allowOrigin: 'null' };
}

async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  try {
    const body = new URLSearchParams();
    body.append('secret', secret);
    body.append('response', token);
    body.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await res.json() as { success?: boolean };
    return data.success === true;
  } catch {
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
  // NOTE: get/put is non-atomic. Concurrent requests can race; this is OK for
  // an advisory layer but not for primary defense.
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  return true;
}

function meetsRequiredFields(clean: Record<string, string>, formId: string): boolean {
  const rules = REQUIRED_FIELDS[formId] ?? REQUIRED_FIELDS.default;
  return rules.some(group => group.every(field => clean[field] && clean[field].length > 0));
}

// ---------- Handlers ----------
export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  const reqOrigin = request.headers.get('Origin');
  const originCheck = checkOrigin(env, reqOrigin);
  const allowOrigin = originCheck.allowOrigin;

  if (!originCheck.accept) {
    return reject(allowOrigin, 403, 'Origin not allowed');
  }

  // Read body with hard size cap. Don't trust Content-Length — chunked or
  // missing-header requests bypass that check. Read text first, measure,
  // then parse.
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return reject(allowOrigin, 400, 'Could not read body');
  }
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return reject(allowOrigin, 413, 'Payload too large');
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return reject(allowOrigin, 400, 'Invalid JSON');
  }

  // Honeypot — silently accept bot submissions so they don't retry
  const honeypot = payload['_honeypot'];
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    console.log('[contact] honeypot triggered, silently dropping');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders(allowOrigin),
    });
  }

  // Turnstile (if configured)
  if (env.TURNSTILE_SECRET_KEY) {
    const token = payload['cf-turnstile-response'];
    if (typeof token !== 'string') return reject(allowOrigin, 400, 'Missing challenge token');
    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    const ok = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
    if (!ok) return reject(allowOrigin, 403, 'Challenge failed');
  }

  // Advisory rate limit
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const allowed = await rateLimit(env.RATE_LIMIT_KV, ip);
  if (!allowed) return reject(allowOrigin, 429, 'Too many requests');

  // Field allowlist + sanitization
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const s = String(v).slice(0, MAX_FIELD_LENGTH);
    clean[k] = s.replace(/[\r\n]+/g, ' ').trim();
  }

  // Required-field enforcement (per formId)
  const formId = clean.formId ?? 'default';
  if (!meetsRequiredFields(clean, formId)) {
    return reject(allowOrigin, 400, 'Missing required fields');
  }

  // Email format check
  if (clean.email && !EMAIL_RE.test(clean.email)) {
    return reject(allowOrigin, 400, 'Invalid email format');
  }

  // Mailgun send (only if configured — otherwise stub-success for dev)
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    console.log('[contact] Mailgun not configured. Payload:', clean);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders(allowOrigin) });
  }

  try {
    const form = new URLSearchParams();
    form.append('from', `Website Contact <noreply@${env.MAILGUN_DOMAIN}>`);
    form.append('to', env.NOTIFY_TO_EMAIL ?? `admin@${env.MAILGUN_DOMAIN}`);
    form.append('subject', `New contact: ${clean.formId ?? 'website'}`);
    if (clean.email) form.append('h:Reply-To', clean.email);
    // ⚠️ Any field in clean lands in the email body. See file header.
    form.append('text', Object.entries(clean).map(([k, v]) => `${k}: ${v}`).join('\n'));

    const res = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
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
