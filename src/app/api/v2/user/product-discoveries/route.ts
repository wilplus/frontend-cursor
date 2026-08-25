import { callBackend } from "@/app/api/_lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return callBackend("/v2/user/product-discoveries", { method: "GET" });
}
