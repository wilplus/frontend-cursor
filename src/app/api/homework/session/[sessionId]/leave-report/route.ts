import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";
import { proxyResponse } from "@/app/api/proxyResponse";

export const runtime = "nodejs";
export const maxDuration = 30;

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = params?.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Missing or invalid sessionId" },
      { status: 400 }
    );
  }

  const backend = getBackendUrl();
  if (!backend) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 503 }
    );
  }

  const upstreamRes = await fetch(`${backend}/v2/homework/session/${sessionId}/leave-report`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  return proxyResponse(upstreamRes);
}
