import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

/**
 * GET paginated admin-imported recordings for the ML review flow.
 * Backend target: GET /v2/admin/recordings/imports
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backend = getBackendUrl();
  const search = request.nextUrl.searchParams.toString();
  const res = await fetch(`${backend}/v2/admin/recordings/imports${search ? `?${search}` : ""}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
