import "server-only";
import { NextRequest } from "next/server";
import { callBackend, relayStrict, type Failures } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/**
 * GET /api/v2/explore/arc/[arcId]/blocks/variants
 *
 * BFF proxy — the block-variant PICKER read (BLOCK_VARIANTS_ENABLED). Every
 * text each block has ever had: take variants (verbatim, take-badged) plus
 * the student's latest edit. Verbatim relay: 404 is a first-class state
 * (flag off / pre-migration arc / not owner) meaning "render nothing new",
 * never an error.
 */

const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { error: "Not authenticated" } },
  notConfigured: { status: 502, body: { error: "Backend URL not configured" } },
  unreachable: { status: 502, body: { error: "Variants service unavailable." } },
};
const RELAY = relayStrict({ empty: "bare" });

export async function GET(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const id = encodeURIComponent(params.arcId);
  return callBackend(`/v2/explore/arc/${id}/blocks/variants`, {
    method: "GET",
    failures: FAILURES,
    relay: RELAY,
  });
}
