import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { SharingConsentResponse } from "@/lib/api/types";

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

export async function GET(req: NextRequest) {
  return proxyJson<SharingConsentResponse>(
    "/v2/user/sharing-consent",
    undefined,
    req
  );
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as PutBody;
  return proxyJson<PutBody, SharingConsentResponse>(
    "/v2/user/sharing-consent",
    { method: "PUT", body },
    req
  );
}
