import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { backendFetch, getAccessToken } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", error: "Authentication required." },
      { status: 401 }
    );
  }
  const forwarded = new URLSearchParams();
  for (const key of ["project", "feature_id"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) forwarded.set(key, value);
  }
  const suffix = forwarded.toString();
  try {
    const upstream = await backendFetch(
      `/v2/admin/ceo/tasks/export${suffix ? `?${suffix}` : ""}`,
      { method: "GET", token }
    );
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") ?? "application/octet-stream",
        "Content-Disposition":
          upstream.headers.get("Content-Disposition") ??
          'attachment; filename="ceo-tasks.md"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { code: "PROXY_ERROR", error: "Something went wrong on our end." },
      { status: 502 }
    );
  }
}
