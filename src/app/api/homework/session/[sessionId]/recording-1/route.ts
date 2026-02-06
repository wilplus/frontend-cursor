import type { NextRequest } from "next/server";
import { proxyMultipart } from "@/lib/api/bff";
import {
  useMockHomework,
  requireAuth,
  mockRecording1Response,
} from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const unauth = await requireAuth(req);
  if (unauth) return unauth;

  const formData = await req.formData();

  if (useMockHomework()) {
    return Response.json(mockRecording1Response());
  }

  const { sessionId } = await params;
  const res = await proxyMultipart(`/v2/homework/session/${sessionId}/recording-1`, formData, "POST", req);
  if (res.status === 404) {
    return Response.json(mockRecording1Response());
  }
  return res;
}
