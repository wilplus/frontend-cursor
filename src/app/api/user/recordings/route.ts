import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyJson, copyCookies } from "@/lib/api/bff";
import type { ListRecordingsResponse } from "@/lib/api/types";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.toString();
  const path = `/user/recordings${search ? `?${search}` : ""}`;

  const response = await proxyJson(path, undefined, req);

  if (!response.ok) {
    return response;
  }

  try {
    const backendData = await response.json();

    const transformedData: ListRecordingsResponse = {
      items: (backendData.recordings || []).map((rec: any) => ({
        id: rec.id,
        created_at: rec.created_at,
        duration: rec.duration_seconds || rec.duration || 0,
      })),
      limit: backendData.limit || 10,
      offset: backendData.offset || 0,
      total: backendData.total,
    };

    const out = NextResponse.json(transformedData);
    copyCookies(response, out);
    return out;
  } catch (error) {
    console.error("[API /user/recordings] Error transforming response:", error);
    return response;
  }
}

