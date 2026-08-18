import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { arcId: string } }
) {
  const arc = encodeURIComponent(params.arcId);
  return callBackend(`/v2/explore/arc/${arc}/journey/next-steps`, {
    method: "POST",
  });
}
