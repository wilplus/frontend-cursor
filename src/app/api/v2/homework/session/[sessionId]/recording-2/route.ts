import type { NextRequest } from "next/server";
import { proxyMultipart } from "@/lib/api/bff";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const formData = await req.formData();
  return proxyMultipart(`/v2/homework/session/${sessionId}/recording-2`, formData, "POST", req);
}
