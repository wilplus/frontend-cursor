import { getAuthToken } from "@/lib/api/auth-client";

export type SendTakeToCoachResult =
  | { kind: "sent"; alreadySent: boolean }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string };

/** Send one exact, authenticated Project Take to asynchronous coach review. */
export async function sendTakeToCoach(
  projectId: string,
  takeId: string
): Promise<SendTakeToCoachResult> {
  const token = await getAuthToken();
  if (!token) return { kind: "unauthenticated" };

  let response: Response;
  try {
    response = await fetch(
      `/api/v2/projects/${encodeURIComponent(projectId)}/takes/${encodeURIComponent(takeId)}/send-to-coach`,
      {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  } catch {
    return {
      kind: "error",
      message: "Your take is safe, but it could not be sent for review. Please retry.",
    };
  }

  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (response.status === 401) return { kind: "unauthenticated" };
  if (!response.ok || body?.review_pending !== true) {
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
