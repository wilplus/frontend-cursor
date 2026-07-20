import { submitLabRecording } from "@/services/api/labRecording";

/* -------------------------------------------------------------------------- */
/*  reRecordSnippet — DELIVERY_STARS snippet re-record (BE PR #222 contract)   */
/*                                                                            */
/*  A delivery star's action re-records ONE snippet with the feedback applied  */
/*  (slower / more emphasis / a breath before it). On the wire this is a READ  */
/*  on the existing record POST — there is no per-snippet endpoint:            */
/*                                                                            */
/*    POST /v2/lab/recordings (multipart), flat fields:                        */
/*      recording_kind     "read"                                              */
/*      paired_session_id  the snippet's spoken take (reads fold under it)     */
/*      paired_snippet_id  the target snippet (labels the coach fold)          */
/*      guest_session_id   fresh id — the read is its own session              */
/*                                                                            */
/*  Flat fields are load-bearing: the intake validator strips unknown keys     */
/*  from session_context, so nesting these would silently drop them.           */
/* -------------------------------------------------------------------------- */

export async function reRecordSnippet(args: {
  snippetId: string;
  /** The snippet's spoken take — the REQUIRED pairing target. */
  takeSessionId: string;
  /** The take's topic (the record POST requires one). */
  topic: string | null;
  audio: Blob;
  durationSec: number;
}): Promise<{ ok: boolean }> {
  const r = await submitLabRecording({
    audioBlob: args.audio,
    durationSec: args.durationSec,
    topic: args.topic ?? "Snippet re-record",
    recordingKind: "read",
    pairedSessionId: args.takeSessionId,
    pairedSnippetId: args.snippetId,
    // A read is its own session; never overwrite the spoken take.
    guestSessionId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `snippet-read-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  });
  return { ok: r.kind === "ok" || r.kind === "processing" };
}
