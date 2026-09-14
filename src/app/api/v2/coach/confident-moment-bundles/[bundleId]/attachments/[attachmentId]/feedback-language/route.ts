import { callBackend } from "@/app/api/_lib/backend";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ bundleId: string; attachmentId: string }>;
  },
) {
  const { bundleId, attachmentId } = await context.params;
  return callBackend(
    `/v2/coach/confident-moment-bundles/${encodeURIComponent(
      bundleId,
    )}/attachments/${encodeURIComponent(attachmentId)}/feedback-language`,
    {
      method: "POST",
      body: await request.text(),
      headers: { "Content-Type": "application/json" },
    },
  );
}
