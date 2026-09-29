import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayLenient, type Failures } from "@/app/api/_lib/backend";

/**
 * POST /api/v2/coach/exercises/script-draft
 *
 * A first script for the coach's exercise video, drafted from the library's
 * own past finals for the named speaking errors (founder 2026-09-29,
 * decision 4). Verbatim pass-through to `/v2/coach/exercises/script-draft`.
 *
 * THE DRAFT GOES TO THE COACH ONLY. Nothing is stored by this call; the draft
 * is kept beside the coach's final only when they save, and served nowhere.
 *
 *   200 { draft, model_version }
 *   400 — no error named, or one the library does not know
 *   403 — caller is not a coach
 *   503 — no draft could be written right now
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { code: "PROXY_ERROR", error: "Drafting unavailable." } },
  timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "The draft took too long. Try again." } },
};
const RELAY = relayLenient();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);
  try {
    return await callBackend("/v2/coach/exercises/script-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      failures: FAILURES,
      relay: RELAY,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
