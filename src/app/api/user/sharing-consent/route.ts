import "server-only";
import { NextRequest } from "next/server";
import { callBackend, LEGACY_FAILURES, relayLegacy } from "@/app/api/_lib/backend";

/**
 * BFF: /api/user/sharing-consent
 *
 * Proxies the per-user "snippet sharing" consent surface — one-time
 * global question asked after the user rates their first snippet (see
 * ChatInterview consent splice). Backend endpoint contract:
 *
 *   GET  /v2/user/sharing-consent
 *     → { has_answered: boolean, opt_in: boolean | null }
 *
 *   PUT  /v2/user/sharing-consent  body: { opt_in: boolean }
 *     → same shape as GET (with the new state echoed back)
 *
 * Defensive on the client side: if backend hasn't shipped the endpoint
 * yet (404), the frontend treats has_answered as true so the prompt
 * stays suppressed until both halves are live.
 */

type PutBody = { opt_in: boolean };

// proxyJson (src/lib/api/bff.ts, deleted in Q-A8) answered with its own
// envelope and a 30 s budget; both are kept verbatim via LEGACY_FAILURES and
// relayLegacy until the copy is unified.
export async function GET(_req: NextRequest) {
  const path = "/v2/user/sharing-consent";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    return await callBackend(path, {
      method: "GET",
      signal: controller.signal,
      failures: LEGACY_FAILURES,
      relay: relayLegacy(path),
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as PutBody;
  const path = "/v2/user/sharing-consent";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    return await callBackend(path, {
      method: "PUT",
      ...(body != null
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
      signal: controller.signal,
      failures: LEGACY_FAILURES,
      relay: relayLegacy(path),
    });
  } finally {
    clearTimeout(timer);
  }
}
