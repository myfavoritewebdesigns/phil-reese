/**
 * Shared submit handler for all contact forms.
 *
 * Tag any <form> with `data-pr-contact-form` and set `data-form-id="<source>"`.
 * POSTs to /api/contact (Cloudflare Pages Function — wire up Mailgun there).
 * Gracefully stubs to a 404 no-op during development.
 */

import { contact } from "../config/site";

type FormState = "idle" | "submitting" | "success" | "error";

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
      setState(form, "success", "Thanks — we'll be in touch shortly.");
      form.reset();
      return;
    }
    // 404 = CF Pages Function not wired yet (dev mode stub)
    if (res.status === 404) {
      console.info("[contact-form] /api/contact not wired yet. Payload:", payload);
      setState(form, "success", "Thanks — we got your details.");
      form.reset();
      return;
    }
    setState(form, "error", `Something went wrong. Please call ${contact.phone}.`);
  } catch (err) {
    console.error("[contact-form]", err);
    setState(form, "error", `Network error. Please call ${contact.phone}.`);
  }
}

function init() {
  const forms = document.querySelectorAll<HTMLFormElement>("form[data-pr-contact-form]");
  forms.forEach((form) => {
    if (form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    form.addEventListener("submit", handleSubmit);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
