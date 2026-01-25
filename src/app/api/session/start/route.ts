import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { SessionStartRequest } from "@/lib/api/types";

export async function POST(req: NextRequest) {
  try {
    // Try to parse body, but allow empty body if Flask doesn't need it
    let body: SessionStartRequest | null = null;
    const contentType = req.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      try {
        body = await req.json();
        console.log("[API /session/start] Request body:", body);
      } catch {
        // Body might be empty, that's okay
        body = null;
      }
    }
    
    return proxyJson("/session/start", { method: "POST", body });
  } catch (error) {
    console.error("Error in session/start route:", error);
    return proxyJson("/session/start", { method: "POST", body: null });
  }
}

