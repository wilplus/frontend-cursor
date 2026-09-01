import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { arcId: string } },
) {
  const arcId = encodeURIComponent(params.arcId);
  const query = new URLSearchParams();
  const snapshotId = request.nextUrl.searchParams.get("document_snapshot_id");
  const sections = request.nextUrl.searchParams.get("sections");
  if (snapshotId) query.set("document_snapshot_id", snapshotId);
  if (sections) query.set("sections", sections);
  return callBackend(
    `/v2/explore/arc/${arcId}/ideal-text/enrichment?${query.toString()}`,
    { method: "GET" },
  );
}

