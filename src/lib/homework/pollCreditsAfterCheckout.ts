/**
 * After Stripe Checkout success, call claim (instant) then poll status if needed.
 * Before redirect to Stripe, store balance: sessionStorage.setItem(PRE_CHECKOUT_CREDITS_KEY, String(credits)).
 */

export const PRE_CHECKOUT_CREDITS_KEY = "homework_credits_before_checkout";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickCreditsFromPayload(v: unknown): number | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  for (const key of ["credits", "new_credits", "balance"]) {
    const x = o[key];
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (typeof x === "string" && x.trim() !== "") {
      const n = Number(x);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Human-readable backend JSON for toasts (Flask-style error, code, message). */
export function formatClaimErrorBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const o = body as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code.trim() : "";
  const err = typeof o.error === "string" ? o.error.trim() : "";
  const msg = typeof o.message === "string" ? o.message.trim() : "";
  const parts = [code && `[${code}]`, err || msg].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

/** If true, claim won't be fixed by polling status — show error and stop. */
function shouldAbortPollingAfterClaim(status: number, _body: unknown): boolean {
  if (status === 401 || status === 403 || status === 404) return true;
  if (status === 422) return false;
  if (status === 400 || status === 503) return true;
  /**5xx: backend/BFF error — do not spin loading + poll ~45s; show error and fix Railway/Stripe. */
  if (status >= 500) return true;
  return false;
}

async function authFetchInit(base: RequestInit = {}): Promise<RequestInit> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(base.headers);
  if (!headers.has("Content-Type") && base.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return { ...base, headers, credentials: "include" };
}

export type PollCreditsResult =
  | { ok: true; credits: number }
  | {
      ok: false;
      reason:
        | "unauthorized"
        | "timeout"
        | "bad_response"
        | "claim_failed";
      message?: string;
    };

export async function claimStripeCheckoutCredits(
  checkoutSessionId: string,
  claimPath = "/api/homework/stripe/claim-checkout"
): Promise<
  | { ok: true; credits: number; duplicate?: boolean }
  | { ok: false; status: number; body: unknown }
> {
  const res = await fetch(
    claimPath,
    await authFetchInit({
      method: "POST",
      body: JSON.stringify({ checkout_session_id: checkoutSessionId }),
    })
  );
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    return { ok: false, status: res.status, body: data };
  }
  const credits = pickCreditsFromPayload(data);
  if (credits === null) {
    return { ok: false, status: res.status, body: data };
  }
  const d = data as { duplicate?: unknown };
  return {
    ok: true,
    credits,
    duplicate: Boolean(d.duplicate),
  };
}

/** Claim with retries when Stripe session is not `paid` yet (common right after redirect). */
async function claimUntilPaidOrExhausted(
  checkoutSessionId: string,
  claimPath: string,
  maxAttempts: number,
  delayMs: number
): Promise<
  | { ok: true; credits: number; duplicate?: boolean }
  | { ok: false; lastBody: unknown; lastStatus: number }
> {
  let lastBody: unknown = {};
  let lastStatus = 200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(delayMs);
    }
    const res = await fetch(
      claimPath,
      await authFetchInit({
        method: "POST",
        body: JSON.stringify({ checkout_session_id: checkoutSessionId }),
      })
    );
    let data: unknown = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    lastBody = data;
    lastStatus = res.status;
    if (!res.ok) {
      return { ok: false, lastBody: data, lastStatus: res.status };
    }
    const credits = pickCreditsFromPayload(data);
    if (credits !== null) {
      const d = data as { duplicate?: unknown };
      return {
        ok: true,
        credits,
        duplicate: Boolean(d.duplicate),
      };
    }
    const skipped =
      typeof data === "object" &&
      data !== null &&
      "skipped" in data &&
      typeof (data as { skipped?: unknown }).skipped === "string"
        ? (data as { skipped: string }).skipped
        : null;
    if (skipped === "not_paid" || skipped === "not_payment_mode") {
      if (typeof console !== "undefined" && console.debug) {
        console.debug("[credits] claim-checkout skipped, retrying", {
          attempt,
          skipped,
        });
      }
      continue;
    }
    return { ok: false, lastBody: data, lastStatus: res.status };
  }
  return { ok: false, lastBody, lastStatus };
}

export async function pollCreditsAfterCheckout(options?: {
  intervalMs?: number;
  maxWaitMs?: number;
  statusPath?: string;
  checkoutSessionId?: string;
  claimMaxAttempts?: number;
  claimRetryDelayMs?: number;
}): Promise<PollCreditsResult> {
  const intervalMs = options?.intervalMs ?? 1000;
  const maxWaitMs = options?.maxWaitMs ?? 45000;
  const statusPath = options?.statusPath ?? "/api/homework/session/status";
  const cs = (options?.checkoutSessionId ?? "").trim();
  const claimPath = "/api/homework/stripe/claim-checkout";
  const claimMaxAttempts = options?.claimMaxAttempts ?? 12;
  const claimRetryDelayMs = options?.claimRetryDelayMs ?? 900;

  if (cs) {
    const claimed = await claimUntilPaidOrExhausted(
      cs,
      claimPath,
      claimMaxAttempts,
      claimRetryDelayMs
    );
    if (claimed.ok) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PRE_CHECKOUT_CREDITS_KEY);
      }
      return { ok: true, credits: claimed.credits };
    }

    const msg =
      formatClaimErrorBody(claimed.lastBody) ??
      `Credits claim failed (HTTP ${claimed.lastStatus}).`;

    if (shouldAbortPollingAfterClaim(claimed.lastStatus, claimed.lastBody)) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[credits] claim-checkout aborted (no status poll)", {
          lastStatus: claimed.lastStatus,
          lastBody: claimed.lastBody,
        });
      }
      return {
        ok: false,
        reason: "claim_failed",
        message: msg,
      };
    }

    if (typeof console !== "undefined" && console.warn) {
      console.warn("[credits] claim-checkout did not apply credits; polling status", {
        lastStatus: claimed.lastStatus,
        lastBody: claimed.lastBody,
      });
    }
  }

  const rawPrev =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem(PRE_CHECKOUT_CREDITS_KEY)
      : null;
  const previousCredits =
    rawPrev !== null && rawPrev !== "" ? Number(rawPrev) : NaN;
  const hasPrevious = Number.isFinite(previousCredits);

  const deadline = Date.now() + maxWaitMs;
  let lastCredits: number | null = null;
  let pollBaseline: number | null = null;

  while (Date.now() < deadline) {
    const res = await fetch(statusPath, await authFetchInit({ method: "GET" }));
    if (res.status === 401) {
      return { ok: false, reason: "unauthorized" };
    }
    if (!res.ok) {
      await sleep(intervalMs);
      continue;
    }
    let data: unknown = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    const c = pickCreditsFromPayload(data);
    if (c === null) {
      return { ok: false, reason: "bad_response" };
    }
    lastCredits = c;
    if (pollBaseline === null) {
      pollBaseline = c;
    }

    if (hasPrevious && c > previousCredits) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PRE_CHECKOUT_CREDITS_KEY);
      }
      return { ok: true, credits: c };
    }

    if (!hasPrevious && pollBaseline !== null && c > pollBaseline) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PRE_CHECKOUT_CREDITS_KEY);
      }
      return { ok: true, credits: c };
    }

    await sleep(intervalMs);
  }

  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(PRE_CHECKOUT_CREDITS_KEY);
  }

  if (
    lastCredits !== null &&
    hasPrevious &&
    lastCredits > previousCredits
  ) {
    return { ok: true, credits: lastCredits };
  }
  if (
    lastCredits !== null &&
    !hasPrevious &&
    pollBaseline !== null &&
    lastCredits > pollBaseline
  ) {
    return { ok: true, credits: lastCredits };
  }

  return {
    ok: false,
    reason: "timeout",
    message:
      "Balance did not change after payment. Check Railway/Stripe logs or run claim-checkout for this session.",
  };
}
