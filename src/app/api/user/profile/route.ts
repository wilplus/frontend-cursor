import "server-only";
import { NextRequest } from "next/server";
import { callBackend, LEGACY_FAILURES, relayLegacy } from "@/app/api/_lib/backend";



// proxyJson (src/lib/api/bff.ts, deleted in Q-A8) answered with its own
// envelope and a 30 s budget; both are kept verbatim via LEGACY_FAILURES and
// relayLegacy until the copy is unified.
export async function GET(_req: NextRequest) {
  const path = "/user/profile";
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
