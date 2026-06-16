/**
 * Shared submit handler for all contact forms.
 *
 * Tag any <form> with `data-pr-contact-form` and set `data-form-id="<source>"`.
 * Each form gets an hCaptcha widget rendered just above its submit button (spam
 * control mirrors Joe's Vintage Guitars). On submit the payload — including the
 * solved `h-captcha-response` token — POSTs as JSON to /api/contact (the
 * Cloudflare Pages Function in functions/api/contact.ts).
 *
 * The hCaptcha script loads lazily — only on pages with a form, AND only once
 * the visitor first interacts with one (focus or pointer/touch), so it stays off
 * the initial-load critical path (a Core Web Vitals win). If the public site key
 * isn't configured, the widget is skipped and the form still submits (the server
 * enforces the captcha only when HCAPTCHA_SECRET is set).
 */

import { contact, hcaptchaSiteKey } from "../config/site";

type FormState = "idle" | "submitting" | "success" | "error";

/** Minimal shape of the hCaptcha API we use (explicit-render mode). */
interface HCaptcha {
  render(el: HTMLElement, opts: { sitekey: string }): string;
  getResponse(widgetId?: string): string;
  reset(widgetId?: string): void;
}
declare global {
  interface Window {
    hcaptcha?: HCaptcha;
    onPrHcaptchaLoad?: () => void;
  }
}

const HCAPTCHA_SRC =
  "https://js.hcaptcha.com/1/api.js?render=explicit&onload=onPrHcaptchaLoad";

/** Render one widget per form, just above its submit button. Idempotent. */
function renderCaptchas() {
  const hcaptcha = window.hcaptcha;
  if (!hcaptcha || !hcaptchaSiteKey) return;
  document
    .querySelectorAll<HTMLFormElement>("form[data-pr-contact-form]")
    .forEach((form) => {
      if (form.dataset.hcaptchaId) return; // already rendered
      const mount = document.createElement("div");
      mount.className = "h-captcha-mount";
      mount.style.margin = "16px 0";
      // Use insertBefore (Node), not Element.before() — the latter's DOM type
      // collides with @cloudflare/workers-types' HTMLRewriter Element.before().
      const submit = form.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]');
      if (submit && submit.parentNode) submit.parentNode.insertBefore(mount, submit);
      else form.appendChild(mount);
      try {
        form.dataset.hcaptchaId = hcaptcha.render(mount, { sitekey: hcaptchaSiteKey });
      } catch (err) {
        console.error("[contact-form] hcaptcha render failed", err);
      }
    });
}

/** Inject the hCaptcha script once; render widgets when it finishes loading. */
function loadHcaptcha() {
  if (!hcaptchaSiteKey) return;
  if (document.querySelector("script[data-pr-hcaptcha]")) return;
  window.onPrHcaptchaLoad = renderCaptchas;
  const s = document.createElement("script");
  s.src = HCAPTCHA_SRC;
  s.async = true;
  s.defer = true;
  s.dataset.prHcaptcha = "1";
  document.head.appendChild(s);
}

function setState(form: HTMLFormElement, state: FormState, message?: string) {
  form.dataset.state = state;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = state === "submitting";

  let banner = form.querySelector<HTMLDivElement>(".pr-form-banner");
  if (!banner && state !== "idle") {
    banner = document.createElement("div");
    banner.className = "pr-form-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    form.appendChild(banner);
  }
  if (banner) {
    banner.textContent = message ?? "";
    banner.dataset.state = state;
  }
}

async function handleSubmit(e: SubmitEvent) {
  const form = e.currentTarget as HTMLFormElement;
  e.preventDefault();

  if (!form.checkValidity()) { form.reportValidity(); return; }

  // Require a solved hCaptcha before bothering the server.
  const widgetId = form.dataset.hcaptchaId;
  const token = window.hcaptcha?.getResponse(widgetId) ?? "";
  if (form.dataset.hcaptchaId && !token) {
    setState(form, "error", "Please complete the “I'm human” check above.");
    return;
  }

  const data = new FormData(form);
  const payload: Record<string, unknown> = {
    formId: form.dataset.formId ?? "unknown",
    submittedAt: new Date().toISOString(),
  };
  for (const [k, v] of data.entries()) payload[k] = v;

  setState(form, "submitting", "Sending…");

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setState(form, "success", "Thanks — Phil will be in touch shortly.");
      form.reset();
      window.hcaptcha?.reset(widgetId);
      return;
    }
    // 404 = CF Pages Function not wired yet (dev mode stub)
    if (res.status === 404) {
      console.info("[contact-form] /api/contact not wired yet. Payload:", payload);
      setState(form, "success", "Thanks — we got your details.");
      form.reset();
      window.hcaptcha?.reset(widgetId);
      return;
    }
    setState(form, "error", `Something went wrong. Please call ${contact.phone}.`);
    window.hcaptcha?.reset(widgetId);
  } catch (err) {
    console.error("[contact-form]", err);
    setState(form, "error", `Network error. Please call ${contact.phone}.`);
    window.hcaptcha?.reset(widgetId);
  }
}

function init() {
  const forms = document.querySelectorAll<HTMLFormElement>("form[data-pr-contact-form]");
  if (forms.length === 0) return;

  // Defer the hCaptcha third-party script until the visitor first interacts with
  // a form (focus or pointer/touch). Keeps ~api.js off the initial-load critical
  // path; it still loads well before they can submit, since filling any field
  // fires focusin first. loadHcaptcha() is idempotent, so double-arming is safe.
  let armed = false;
  const armHcaptcha = () => {
    if (armed) return;
    armed = true;
    loadHcaptcha();
  };

  forms.forEach((form) => {
    if (form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    form.addEventListener("submit", handleSubmit);
    form.addEventListener("focusin", armHcaptcha, { once: true });
    form.addEventListener("pointerdown", armHcaptcha, { once: true });
  });

  // If hCaptcha is already present (bfcache restore / prior init pass), render now.
  if (window.hcaptcha) renderCaptchas();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
