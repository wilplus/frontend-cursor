import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { practiceId: string } },
): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { code: "INVALID_MULTIPART", error: "Invalid audio upload." },
      { status: 400 },
    );
  }
  return callBackend(
    `/v2/user/confidence-practice/${encodeURIComponent(params.practiceId)}/attempts`,
    { method: "POST", body: form },
  );
}
