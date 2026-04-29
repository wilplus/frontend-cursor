import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

/**
 * POST multipart/form-data: upload curated audio for a student.
 * Proxies to POST /v2/admin/students/:userId/sessions/upload-recording.
 * Backend creates a v2 homework session and runs the analysis pipeline.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: userId } = await params;
  const formData = await request.formData();
  const backend = getBackendUrl();
  const res = await fetch(
    `${backend}/v2/admin/students/${userId}/sessions/upload-recording`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data, { status: res.status });
}
