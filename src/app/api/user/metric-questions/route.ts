import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export interface UserMetricQuestionsResponse {
  metric_question_1?: string;
  metric_question_2?: string;
  metric_question_3?: string;
}

export async function GET(req: NextRequest) {
  return proxyJson<UserMetricQuestionsResponse>("/user/metric-questions", undefined, req);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyJson<unknown, UserMetricQuestionsResponse>("/user/metric-questions", { method: "PATCH", body }, req);
}
