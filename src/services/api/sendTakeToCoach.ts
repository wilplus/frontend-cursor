import { bffFetch } from "@/lib/api/bffFetch";

export type SendTakeToCoachResult =
  | { kind: "sent"; alreadySent: boolean }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string };

/** Send one exact, authenticated Project Take to asynchronous coach review. */
export async function sendTakeToCoach(
  projectId: string,
  takeId: string
): Promise<SendTakeToCoachResult> {
  const result = await bffFetch(
    `/api/v2/projects/${encodeURIComponent(projectId)}/takes/${encodeURIComponent(takeId)}/send-to-coach`,
    { method: "POST", credentials: "include" }
  );
  if (result.kind === "unauthenticated") return { kind: "unauthenticated" };
  if (result.kind === "network") {
    return {
      kind: "error",
      message: "Your take is safe, but it could not be sent for review. Please retry.",
    };
  }

  const body = result.body as Record<string, unknown> | null;
  if (result.status === 401) return { kind: "unauthenticated" };
  if (!result.ok || body?.review_pending !== true) {
    return {
      kind: "error",
      message:
        typeof body?.error === "string"
          ? body.error
          : "Your take is safe, but it could not be sent for review. Please retry.",
    };
  }
  return { kind: "sent", alreadySent: body.already_sent === true };
}
