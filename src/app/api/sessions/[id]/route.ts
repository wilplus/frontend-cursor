import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyJson(`/v2/sessions/${encodeURIComponent(id)}`, undefined, req);
}
