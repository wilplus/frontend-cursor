import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

type Ctx = { params: Promise<{ id: string; messageIndex: string }> };

/**
 * PATCH /api/admin/students/:id/coach-suggestions/message/:messageIndex
 *
 * Human-in-the-Loop: edit a single AI-generated message in the coach
 * conversation history for a student. The LLM automatically adopts the
 * admin's corrections on the next turn because the full history is passed
 * as context on every call.
 *
 * Body: { content: string }
 * Returns: { status, message_index, updated_message, total_messages }
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, { status: 401 });
  }

  const { id, messageIndex } = await ctx.params;
  const index = parseInt(messageIndex, 10);
  if (!id?.trim() || isNaN(index) || index < 0) {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Missing or invalid studentId / messageIndex" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const backend = getBackendUrl().replace(/\/$/, "");

  const res = await fetch(
    `${backend}/v2/admin/students/${encodeURIComponent(id)}/coach-suggestions/message/${index}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
