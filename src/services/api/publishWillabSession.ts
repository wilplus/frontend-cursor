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
  /** §6b coaching guidance (post-corrections; additive). `when` = how/when to use
   *  it; `examples` = "E.g." lines. Optional — omitted/empty when not authored.
   *  BE must persist + return these on coach.when / coach.examples in the readout. */
  when?: string | null;
  examples?: string[];
}
export interface PublishInput {
  sessionId: string;
  overallMessage: string | null;
  notes: PublishNote[];
  labels: PublishLabel[];
  /** §F.5 / BE 3c — gates email/push notification to the user. In-app
   *  Lounge update always fires (the realtime publish event isn't
   *  silenced). When omitted, defaults to `true`, so any caller that
   *  doesn't set the field keeps the "notification on every publish"
   *  behavior.
   *  CoachReviewOverlay sets it explicitly per §F.5:
   *    - default true for the first publish (state ∈ pending/in_progress)
   *    - default false for edits (state === done)
   *
   *  The BE accepts the field whether 3c is live or not: pre-3c it's
   *  ignored (notification fires unconditionally — today's behavior);
   *  post-3c it gates the email path per the spec. Either way, the FE
   *  contract stays forward-compatible. */
  notifyClient?: boolean;
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
    notify_client: input.notifyClient ?? true,
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
