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
  // The Take a coach's link names (backend N77): the journey reads its word.
  const take = request.nextUrl.searchParams.get("take");
  if (snapshotId) query.set("document_snapshot_id", snapshotId);
  if (sections) query.set("sections", sections);
  if (take) query.set("take", take);
  return callBackend(
    `/v2/explore/arc/${arcId}/ideal-text/enrichment?${query.toString()}`,
    { method: "GET", guestOwnerFrom: request },
  );
}

