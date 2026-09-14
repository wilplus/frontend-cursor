import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/config/recording
 *
 * BFF proxy for the recording product constants (BE, 2026-07-27). Today that
 * is `long_take_caution_sec` — the length at or above which the setup flow
 * offers its soft caution (FE-5).
 *
 * It lives here rather than being echoed on the arc's /setup payload on
 * purpose: it is a PRODUCT constant, not a project field, and a pinned test
 * keeps that payload minimal. Read once at boot; never hardcode the number.
 *
 * Relayed verbatim, including the status.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Config service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function GET(_req: NextRequest) {
  return callBackend("/v2/config/recording", {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
