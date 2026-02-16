import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";
import { requireAuth } from "@/lib/api/homework-mock";

export const dynamic = "force-dynamic";

/**
 * POST notify that a lesson is complete (report generated).
 * Backend should send an email to artur@willonski.com with a link to the admin panel report for this student/session.
 * Called by the frontend when the student reaches the report step (step 5) so the admin is notified.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const unauth = await requireAuth(req);
  if (unauth) return unauth;
  const { sessionId } = params;
  return proxyJson(
    `/v2/homework/session/${sessionId}/notify-lesson-complete`,
    { method: "POST", body: {} },
    req
  );
}
