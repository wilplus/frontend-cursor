import { getAuthToken } from "@/lib/api/auth-client";
import { mapReadoutPayload, type ReadoutPayload } from "@/components/willab/readout";
import { mapRecordingProgress, type RecordingProgress } from "./recordingProgress";
import { type PresentationSlide } from "@/components/willab/presentation";
import { type Feeling } from "@/components/willab/willabFeelings";

/* -------------------------------------------------------------------------- */
/*  labRecording — the Lab upload client (seam ③, §3.3)                        */
/*                                                                            */
/*  POST /api/v2/lab/recordings — multipart, SYNCHRONOUS (~3–5s): 201 + the    */
/*  finished Readout, or 422 (min-content gate → re-record). Public/guest:     */
/*  the token is forwarded when signed (for scoping) but never required.       */
/* -------------------------------------------------------------------------- */

export interface LabUploadInput {
  audioBlob: Blob;
  durationSec: number;
  topic: string;
  audience?: string;
  targetLengthSeconds?: number | null;
  domainVocabulary?: string[];
  /** Slide-deck context (§S): title/body per slide, rides as a JSON field. */
  slides?: PresentationSlide[];
  /** The BE-served PDF url linking the rendered deck; omitted = manual-only. */
  presentationRef?: string | null;
  /** Tap timeline — which slide was advanced to, at t_ms from record start. */
  slideAdvances?: { index: number; tMs: number }[];
  /** Explore-session arc (Prompt B §F2). Set explore_session=true on take 1
   *  (no arc_id yet); subsequent takes carry the returned arc_id + incremented
   *  take_index. undefined = standalone recording, arc_id null on response. */
  exploreSession?: boolean;
  arcId?: string;
  takeIndex?: number;
  /** Pre-recording feeling — private correlation input (AC-9, never shown back). */
  feeling?: Feeling;
}

export type LabUploadResult =
  | { kind: "ok"; sessionId: string | null; state: string | null; readout: ReadoutPayload; arcId: string | null; takeIndex: number | null; recordingProgress: RecordingProgress | null }
  | { kind: "rejected"; message: string } // 422 — min-content gate
  | { kind: "error"; status: number; message: string };

export async function submitLabRecording(
  input: LabUploadInput
): Promise<LabUploadResult> {
  const form = new FormData();
  // BE Q4 (field names): audio part + domain_vocabulary encoding are the FE's
  // best read of the multipart contract — isolated here, trivial to adjust.
  form.append("audio_file", input.audioBlob, "lab.webm");
  form.append("topic", input.topic);
  if (input.audience) form.append("audience", input.audience);
  if (input.targetLengthSeconds != null) {
    form.append("target_length_seconds", String(input.targetLengthSeconds));
  }
  if (input.domainVocabulary && input.domainVocabulary.length > 0) {
    // A4: one field, JSON-array string (or CSV) — not repeated fields.
    form.append("domain_vocabulary", JSON.stringify(input.domainVocabulary));
  }
  // Slide-deck context (§S): slides JSON + the served-PDF ref + the tap
  // timeline. All optional; the deck deepens the read, it's never required.
  if (input.slides && input.slides.length > 0) {
    form.append("slides", JSON.stringify(input.slides));
  }
  if (input.presentationRef) {
    form.append("presentation_ref", input.presentationRef);
  }
  if (input.slideAdvances && input.slideAdvances.length > 0) {
    form.append(
      "slide_advances",
      JSON.stringify(
        input.slideAdvances.map((a) => ({ index: a.index, t_ms: a.tMs }))
      )
    );
  }
  // Explore-session arc fields — omit entirely for standalone recordings.
  if (input.exploreSession) form.append("explore_session", "true");
  if (input.arcId) form.append("arc_id", input.arcId);
  if (input.takeIndex != null) form.append("take_index", String(input.takeIndex));
  // Pre-recording feeling — private correlation input; AC-9 bars it from any
  // user-facing surface. Omit when absent so the field never arrives as "null".
  if (input.feeling) form.append("feeling", input.feeling);
  // Duration is measured server-side (A4 lists no audio_duration_sec field).

  const token = await getAuthToken(); // optional — public/guest endpoint
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch("/api/v2/lab/recordings", {
      method: "POST",
      headers,
      body: form,
      credentials: "include",
    });
  } catch {
    return {
      kind: "error",
      status: 0,
      message: "Couldn't reach the lab — check your connection and try again.",
    };
  }

  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return {
      kind: "rejected",
      message:
        body?.error ??
        "That take was too short or had no clear speech — let's try again.",
    };
  }
  if (res.status === 402) {
    // Founder rule: a paywall is never an "analysis failed" error. The BE is
    // removing the 402 from the record path entirely; until that lands, keep
    // the copy calm and point at the unlock instead of a scary failure.
    return {
      kind: "error",
      status: 402,
      message:
        "Your recording is safe. This take is part of the full audit. Unlock it on the pricing page to continue.",
    };
  }
  if (!res.ok) {
    return {
      kind: "error",
      status: res.status,
      message: `Analysis failed (HTTP ${res.status}). Try again in a moment.`,
    };
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return { kind: "error", status: res.status, message: "Empty response from the lab." };
  }

  // BE A2 (verified live): 201 = { status, session_id, recording_id, state,
  // session_context, readout:{ snippets[] } }. Snippets sit at readout.snippets;
  // state defaults to readout_ready per the BE note.
  // Fold the BE's TOP-LEVEL audit_paid + human_feedback_visible mirrors into
  // the readout object so the take-aware gating survives the extraction.
  const readoutObj = {
    ...(body.readout && typeof body.readout === "object" ? body.readout : {}),
    ...("audit_paid" in body ? { audit_paid: body.audit_paid } : {}),
    ...("human_feedback_visible" in body
      ? { human_feedback_visible: body.human_feedback_visible }
      : {}),
  };
  return {
    kind: "ok",
    sessionId: typeof body.session_id === "string" ? body.session_id : null,
    state: typeof body.state === "string" ? body.state : "readout_ready",
    readout: mapReadoutPayload(readoutObj),
    arcId: typeof body.arc_id === "string" ? body.arc_id : null,
    takeIndex: typeof body.take_index === "number" ? body.take_index : null,
    recordingProgress: mapRecordingProgress(body.recording_progress),
  };
}
