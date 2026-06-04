import { getAuthToken } from "@/lib/api/auth-client";
import type { CoachTag } from "@/components/willab/readout";

/* -------------------------------------------------------------------------- */
/*  publishWillabSession — the coach publish pivot (§14 / §3.9)                */
/*                                                                            */
/*  POST /api/v2/internal/publish-session-results (existing proxy). Split-sink  */
/*  (§2): `labels` (private direction-v1) and `insights_payload` (user notes +  */
/*  tags) are separate lanes. BE validates the publish floor (every snippet     */
/*  labeled + ≥1 noted+tagged) and 422s a violation — we also gate client-side. */
/* -------------------------------------------------------------------------- */

export type Direction = "threat" | "ambiguous" | "challenge";

export interface PublishLabel {
  snippet_id: string;
  value: Direction;
  was_pre_filled?: boolean;
  was_overridden?: boolean;
}
export interface PublishNote {
  snippet_id: string;
  note: string;
  tag: CoachTag;
}
export interface PublishInput {
  sessionId: string;
  overallMessage: string | null;
  notes: PublishNote[];
  labels: PublishLabel[];
}

export type PublishResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export async function publishWillabSession(
  input: PublishInput
): Promise<PublishResult> {
  const token = await getAuthToken();
  if (!token) {
    return { ok: false, status: 401, message: "Sign in as a coach to publish." };
  }

  const body = {
    session_id: input.sessionId,
    insights_payload: {
      overall_message: input.overallMessage,
      snippet_notes: input.notes,
    },
    labels: input.labels,
  };

  try {
    const res = await fetch("/api/v2/internal/publish-session-results", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const b = (await res.json().catch(() => null)) as { error?: string } | null;
    return {
      ok: false,
      status: res.status,
      message: b?.error ?? `Publish failed (HTTP ${res.status}).`,
    };
  } catch {
    return { ok: false, status: 0, message: "Couldn't reach the server — try again." };
  }
}
