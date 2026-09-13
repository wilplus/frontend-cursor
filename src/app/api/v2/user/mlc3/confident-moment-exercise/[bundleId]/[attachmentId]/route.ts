import "server-only";
import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: { bundleId: string; attachmentId: string } },
) {
  return callBackend(
    `/v2/user/mlc3/confident-moment-exercise/${encodeURIComponent(params.bundleId)}/${encodeURIComponent(params.attachmentId)}`,
    { method: "GET" },
  );
}
