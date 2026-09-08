import { callBackend } from "@/app/api/_lib/backend";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ arcId: string }> },
) {
  const { arcId } = await context.params;
  return callBackend(
    `/v2/coach/guidance/batches/${encodeURIComponent(arcId)}`,
    { method: "GET" },
  );
}
