import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSessionForRequest, copyCookies } from "@/lib/api/bff";

/** Use mock homework when env is set or when no backend URL (dev without backend). */
export function useMockHomework(): boolean {
  return (
    process.env.MOCK_HOMEWORK_BACKEND === "1" ||
    !process.env.NEXT_PUBLIC_API_URL?.trim()
  );
}

/** Return 401 response with refreshed cookies if no session. */
export async function requireAuth(
  req: NextRequest
): Promise<NextResponse | null> {
  const { session, cookieResponse } = await getSessionForRequest(req);
  if (session) return null;
  const res = NextResponse.json(
    { code: "UNAUTHORIZED", error: "Session expired" },
    { status: 401 }
  );
  copyCookies(cookieResponse, res);
  return res;
}

function uuid(): string {
  return crypto.randomUUID();
}

export function mockStartResponse() {
  const text =
    "Read the following aloud at a comfortable pace. This is a sample warm-up task. Then record your response.";
  return {
    session_id: uuid(),
    task: text,
    task_text: text,
  };
}

export function mockRecording1Response() {
  return {
    score: 0.8,
    task_text:
      "Based on your first recording, here is your task. Answer the three prompts below, then complete your final recording.",
    task_block: {
      context_short: "Based on your first recording, here is your task.",
      metric_question_1: { id: "mq1", text: "What is the 1 thing you want your audience to understand?" },
      metric_question_2: { id: "mq2", text: "What is the main emotion you want them to feel during your talk?" },
      metric_question_3: { id: "mq3", text: "What is your key message?" },
    },
  };
}

export function mockMetricAnswersResponse() {
  return {
    final_task_text:
      "For your final recording, deliver a short summary in under 60 seconds.",
  };
}

export function mockRecording2Response() {
  return {
    score: 0.85,
  };
}

export function mockQuestionsResponse() {
  return { questions: [] };
}

export function mockPostAnswersResponse() {
  return {
    report_text:
      "Sample report. You completed the homework flow. Connect a real backend for personalized feedback and scores.",
    score: 0.82,
  };
}
