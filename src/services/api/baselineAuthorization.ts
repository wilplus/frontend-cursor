import { localBaselineRequest } from "./baselinePilot";
import { bffFetch, type BffRequest } from "@/lib/api/bffFetch";
import { acceptAuthorization, processingAcceptanceBody, processingPolicyOf, recordAiNoticeRendered,
  type AcceptanceInput, type AcceptanceResult, type ProcessingPolicy } from "./processingAuthorization";

export type LocalAuthorization = { kind: "authorized" } | {
  kind: "required"; policy: ProcessingPolicy; priorCountry: string | null;
} | { kind: "unavailable" };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function readAuthorization(request: (path: string, options?: BffRequest) => ReturnType<typeof bffFetch>): Promise<LocalAuthorization> {
  const result = await request("");
  if (result.kind !== "response" || !result.ok) return { kind: "unavailable" };
  const row = record(result.body);
  if (row.authorized === true) return { kind: "authorized" };
  if (row.code === "PROCESSING_SERVICE_BLOCKED") return { kind: "unavailable" };
  const policy = processingPolicyOf(row);
  return policy ? { kind: "required", policy,
    priorCountry: typeof row.country_of_residence === "string" ? row.country_of_residence : null,
  } : { kind: "unavailable" };
}

export const privateBaselineAuthorization = {
  status: () => readAuthorization(() => bffFetch("/api/v2/processing-authorization", { cache: "no-store", timeoutMs: 10_000 })),
  accept: acceptAuthorization,
  notice: recordAiNoticeRendered,
};

export const baselineAuthorization = {
  status: () => readAuthorization((path) => localBaselineRequest("/authorization" + path)),
  async accept(input: AcceptanceInput): Promise<AcceptanceResult> {
    const result = await localBaselineRequest("/authorization", { method: "POST", json: processingAcceptanceBody(input) });
    const row = result.kind === "response" ? record(result.body) : {};
    if (row.code === "PROCESSING_POLICY_STALE") return { kind: "stale" };
    if (result.kind === "response" && result.ok && row.authorized === true && typeof row.receipt_id === "string") {
      return { kind: "accepted", receiptId: row.receipt_id,
        policyVersion: typeof row.policy_version === "string" ? row.policy_version : input.policy.policyVersion };
    }
    return { kind: "rejected", code: "LOCAL_AUTHORIZATION_UNAVAILABLE", message: "The agreement could not be recorded. Please try again." };
  },
  async notice(input: Parameters<typeof recordAiNoticeRendered>[0]): Promise<boolean> {
    const result = await localBaselineRequest("/authorization/ai-rendered", { method: "POST", json: {
      ai_notice_version: input.aiNoticeVersion, surface: input.surface, client_render_id: input.clientRenderId,
      rendered_at: new Date().toISOString(), client_version: input.clientVersion,
    } });
    return result.kind === "response" && result.ok;
  },
};
