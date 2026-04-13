/**
 * After Stripe Checkout success, call claim (instant) then poll status if needed.
 * Before redirect to Stripe, store balance: sessionStorage.setItem(PRE_CHECKOUT_CREDITS_KEY, String(credits)).
 */

export const PRE_CHECKOUT_CREDITS_KEY = "homework_credits_before_checkout";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  | { ok: false; reason: "unauthorized" | "timeout" | "bad_response" };

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
  const d = data as { credits?: unknown; duplicate?: unknown };
  const credits =
    typeof d.credits === "number" ? d.credits : Number(d.credits);
  if (!Number.isFinite(credits)) {
    return { ok: false, status: res.status, body: data };
  }
  return {
    ok: true,
    credits,
    duplicate: Boolean(d.duplicate),
  };
}

export async function pollCreditsAfterCheckout(options?: {
  intervalMs?: number;
  maxWaitMs?: number;
  statusPath?: string;
  checkoutSessionId?: string;
}): Promise<PollCreditsResult> {
  const intervalMs = options?.intervalMs ?? 1000;
  const maxWaitMs = options?.maxWaitMs ?? 30000;
  const statusPath = options?.statusPath ?? "/api/homework/session/status";
  const cs = (options?.checkoutSessionId ?? "").trim();

  if (cs) {
    const claimed = await claimStripeCheckoutCredits(cs);
    if (claimed.ok) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PRE_CHECKOUT_CREDITS_KEY);
      }
      return { ok: true, credits: claimed.credits };
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

  while (Date.now() < deadline) {
    const res = await fetch(statusPath, await authFetchInit({ method: "GET" }));
    if (res.status === 401) {
      return { ok: false, reason: "unauthorized" };
    }
    if (!res.ok) {
      await sleep(intervalMs);
      continue;
    }
    const data = (await res.json()) as { credits?: unknown };
    const c =
      typeof data.credits === "number"
        ? data.credits
        : Number(data.credits);
    if (!Number.isFinite(c)) {
      return { ok: false, reason: "bad_response" };
    }
    lastCredits = c;

    if (hasPrevious && c > previousCredits) {
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
  if (lastCredits !== null) {
    return { ok: true, credits: lastCredits };
  }
  return { ok: false, reason: "timeout" };
}
