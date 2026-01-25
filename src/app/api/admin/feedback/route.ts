import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[API /admin/feedback] Request body:", body);
    
    // proxyJson stringifies the body internally (see bff.ts line 72)
    // @ts-ignore - TypeScript inference issue with generic RequestBody type
    return proxyJson("/admin/feedback", { 
      method: "POST", 
      body
    });
  } catch (error) {
    console.error("Error in admin/feedback route:", error);
    return proxyJson("/admin/feedback", { method: "POST", body: null });
  }
}
