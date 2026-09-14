import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/internal/journal/community/generate
 *
 * BFF passthrough for the Community Content Studio: derives the three community
 * formats from a journal post's body.
 *
 * Password-gated on the BACKEND (the admin password rides in the body), so this
 * proxy adds no auth of its own and relays the upstream status verbatim — the
 * CMS distinguishes 401 (wrong password), 404 (unknown post) and 503 (kill
 * switch off, or the model returned nothing usable, so worth retrying).
 *
 * TIMEOUTS ARE THE WHOLE POINT OF THIS FILE. The upstream call is a GPT-4o
 * generation that takes 10-25s, while a route handler otherwise inherits the
 * platform's default limit (10-15s on Vercel) — the sibling passthroughs set
 * none because they answer in milliseconds. Left alone, this would 504 on a
 * request the backend went on to complete successfully, and the founder would
 * see a failure for work that actually happened. So: a generous maxDuration,
 * and an abort just under it that reports a timeout honestly.
 *
 * The password is never logged.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const FAILURES: Failures = {
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Journal service unavailable." } },
  timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "Writing took too long. Try again." } },
};
const RELAY = relayLenient({ bareStatuses: [204, 205, 304] });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);
  try {
    return await callBackend("/v2/internal/journal/community/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      token: null,
      requireAuth: false,
      failures: FAILURES,
      relay: RELAY,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
