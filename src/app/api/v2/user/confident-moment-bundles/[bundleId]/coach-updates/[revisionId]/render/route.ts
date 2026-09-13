import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { bundleId: string; revisionId: string } }) {
  return callBackend(`/v2/user/confident-moment-bundles/${encodeURIComponent(params.bundleId)}/coach-updates/${encodeURIComponent(params.revisionId)}/render`, {
    method: "POST", body: await request.text(), headers: { "Content-Type": "application/json" },
  });
}
