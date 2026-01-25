import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { ListRecordingsResponse, RecordingListItemLite } from "@/lib/api/types";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.toString();
  const path = `/user/recordings${search ? `?${search}` : ""}`;
  
  // Log the request for debugging
  console.log(`[API /user/recordings] Proxying to Flask: ${path}`);
  
  const response = await proxyJson(path);
  
  // Log the response status
  console.log(`[API /user/recordings] Response status: ${response.status}`);
  
  // If response is not OK, return it as-is
  if (!response.ok) {
    return response;
  }
  
  // Transform the backend response to match frontend contract
  try {
    const backendData = await response.json();
    
    // Backend returns { recordings: [...], total, limit, offset }
    // Frontend expects { items: [...], total, limit, offset }
    // where items are RecordingListItemLite { id, created_at, duration }
    
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
    
    console.log(`[API /user/recordings] Transformed ${transformedData.items.length} recordings`);
    
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error("[API /user/recordings] Error transforming response:", error);
    // If transformation fails, return original response
    return response;
  }
}

