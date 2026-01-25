import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import type { AdminFeedbackRequest } from "@/lib/api/types";

export async function POST(req: NextRequest) {
  try {
    const body: AdminFeedbackRequest = await req.json();
    console.log("[API /admin/feedback] Request body:", body);
    
    return proxyJson("/admin/feedback", { method: "POST", body });
  } catch (error) {
    console.error("Error in admin/feedback route:", error);
    return proxyJson("/admin/feedback", { method: "POST", body: null });
  }
}
