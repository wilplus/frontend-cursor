import { getAuthToken } from "@/lib/api/auth-client";
import { mapReadoutPayload, type ReadoutPayload } from "@/components/willab/readout";
import { mapRecordingProgress, type RecordingProgress } from "./recordingProgress";
import { type PresentationSlide } from "@/components/willab/presentation";
import { type Feeling } from "@/components/willab/willabFeelings";
import { mapReadoutSetup } from "@/components/willab/willabLastSetup";
import { type LabSessionContext } from "@/components/willab/LabOverlay";

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
  /** ④ step 5 — a free-text strategic-context note (the stakes, the setting,
   *  what to nail). Sent as `strategic_context`; background context that sharpens
   *  the coaching. Optional. */
  strategicContext?: string;
  /** Tap timeline — which slide was advanced to, at t_ms from record start. */
  slideAdvances?: { index: number; tMs: number }[];
  /** F1 — ms to SUBTRACT from every slideAdvances[].tMs to convert UI time to
   *  AUDIO time: `t_recorderFirstAudio - t_zeroUsedForTapTimes`. The recorder
   *  warms up after start(), so audio runs behind the UI clock and the first
   *  words after a tap would otherwise bucket to the PREVIOUS slide. Measured
   *  per take, normally small and positive. Omitted when unmeasurable, which
   *  leaves the BE on exactly its previous behaviour. */
  slideClockOffsetMs?: number;
  /** Explore-session arc (Prompt B §F2). Set explore_session=true on take 1
   *  (no arc_id yet); subsequent takes carry the returned arc_id + incremented
   *  take_index. undefined = standalone recording, arc_id null on response. */
  exploreSession?: boolean;
  arcId?: string;
  takeIndex?: number;
  /** Context-aware setup (founder 2026-07-22) — the project this take
   *  continues.
   *
   *  FE-4 (2026-07-27) — this is now the FLAT, authoritative field and the BE
   *  numbers the takes, so a continuation no longer sends `take_index`. It
   *  used to ride alongside the legacy arc_id/take_index pair because the
   *  deployed BE resolved the arc from those; sending a take_index the server
   *  also computes is how a take lands under the wrong number, and a wrong
   *  number splits the arc that the ideal text is ranked across. */
  continueArcId?: string;
  /** Pre-recording feeling — private correlation input (AC-9, never shown back). */
  feeling?: Feeling;
  /** R5 — the pre-take priming manipulation the user saw (threat/challenge/
   *  balanced) + the exact phrase. Logged so the framing can be correlated with
   *  the acoustic read; never shown back to the user. undefined for uploads. */
  primingCondition?: "threat" | "challenge" | "balanced";
  primingPhrase?: string;
  /** #191 — "spoken" (the take itself) vs "read" (a re-read of a piece's
   *  corrected text). Default/omitted = spoken (the BE's default). */
  recordingKind?: "spoken" | "read";
  /** #191 — for a read, the spoken session this re-read belongs to. The BE links
   *  it to that take and it does NOT count as a new take. */
  pairedSessionId?: string;
  /** #191 — a fresh id so a read is its own session (the read never overwrites
   *  the spoken take). Sent for reads; omit for the spoken take. */
  guestSessionId?: string;
  /** FE-D — what the read is OF. "ideal_text" marks a read of the ideal text;
   *  with idealVersion it is what flips the GET's reread_done, so always send
   *  both together. FLAT multipart fields (BE PR #222): the intake validator
   *  strips unknown keys from session_context, so nesting would silently drop
   *  them. */
  readTarget?: "ideal_text";
  idealVersion?: number;
  /** DELIVERY_STARS (BE PR #222) — a snippet re-record's target snippet. The
   *  re-record IS a read on this endpoint: recording_kind "read" +
   *  paired_session_id (the take) + this. Flat field, same rule as above. */
  pairedSnippetId?: string;
}

export type LabUploadResult =
  | { kind: "ok"; sessionId: string | null; state: string | null; readout: ReadoutPayload; arcId: string | null; takeIndex: number | null; recordingProgress: RecordingProgress | null }
  /** Async analysis (delivery layer): the BE accepted the upload (202) and is
   *  finishing the analysis in a background daemon — poll the readout until
   *  `ready`/`failed`. Survives a closed tab / locked phone. */
  | { kind: "processing"; sessionId: string; arcId: string | null; takeIndex: number | null; takeCount: number | null }
  | { kind: "rejected"; message: string } // 422 — min-content gate
  | { kind: "error"; status: number; message: string };

/** FE-1 (P0, 2026-07-20) — the recording state machine's ONE invariant, at the
 *  single choke point every upload passes through.
 *
 *  Two founder-reported live bugs shared a root cause: read state leaking onto
 *  a spoken take. A spoken take that carried a read's `paired_session_id` (or
 *  the read's session id) landed ON the re-read's session, so the app
 *  "analysed the re-read" instead of the new take, and the re-read counted as
 *  a take. The BE now hard-guards both sides (unpaired read → 422, used
 *  session id → a fresh one is minted); this is the FE half:
 *
 *    - A SPOKEN take carries NO read state, ever — every read-only field is
 *      stripped here rather than trusted from the call site, so no future
 *      caller can reintroduce the leak.
 *    - A READ without its pairing target never reaches the network: an
 *      unpaired read is invisible on every surface AND would now be a 422, so
 *      we answer with the same rejection locally.
 *
 *  Returns the sanitized input, or a rejection to return as-is. Pure. */
export function guardRecordingInput(
  input: LabUploadInput
): { ok: true; input: LabUploadInput } | { ok: false; message: string } {
  if (input.recordingKind === "read") {
    if (!input.pairedSessionId) {
      return {
        ok: false,
        message: "That reading needs its take. Record a take first.",
      };
    }
    return { ok: true, input };
  }
  // Spoken (or unspecified = the BE's spoken default): strip every read field.
  const {
    recordingKind: _kind,
    pairedSessionId: _paired,
    pairedSnippetId: _snippet,
    readTarget: _target,
    idealVersion: _version,
    // A spoken take never reuses a session id — the BE mints one and the FE
    // adopts the returned `session_id` (a reused id is what made a new take
    // inherit the read's state).
    guestSessionId: _guest,
    ...spoken
  } = input;
  return { ok: true, input: spoken };
}

export async function submitLabRecording(
  rawInput: LabUploadInput
): Promise<LabUploadResult> {
  const guard = guardRecordingInput(rawInput);
  if (!guard.ok) return { kind: "rejected", message: guard.message };
  const input = guard.input;
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
  // ④ step 5 — strategic-context note; sharpens the coaching. Omit when blank so
  // the field never arrives as an empty string. FLAT field (BE PR #222 rule).
  if (input.strategicContext && input.strategicContext.trim()) {
    form.append("strategic_context", input.strategicContext.trim());
  }
  if (input.slideAdvances && input.slideAdvances.length > 0) {
    form.append(
      "slide_advances",
      JSON.stringify(
        input.slideAdvances.map((a) => ({ index: a.index, t_ms: a.tMs }))
      )
    );
  }
  // F1 — the recorder/UI clock gap. Sent even when 0 (an explicit "measured,
  // and it was zero"), but never when unmeasurable, so the BE can tell the
  // difference between a measurement and a missing sender.
  if (
    typeof input.slideClockOffsetMs === "number" &&
    Number.isFinite(input.slideClockOffsetMs)
  ) {
    form.append(
      "slide_clock_offset_ms",
      String(Math.round(input.slideClockOffsetMs))
    );
  }
  // Explore-session arc fields — omit entirely for standalone recordings.
  if (input.exploreSession) form.append("explore_session", "true");
  if (input.arcId) form.append("arc_id", input.arcId);
  if (input.continueArcId) {
    form.append("continue_arc_id", input.continueArcId);
  }
  // FE-4 — the server numbers takes on a continuation. Sending our own guess
  // alongside continue_arc_id is a second, disagreeing opinion about where
  // this take belongs, and the loser is the cross-take comparison.
  if (input.takeIndex != null && !input.continueArcId) {
    form.append("take_index", String(input.takeIndex));
  }
  // Pre-recording feeling — private correlation input; AC-9 bars it from any
  // user-facing surface. Omit when absent so the field never arrives as "null".
  if (input.feeling) form.append("feeling", input.feeling);
  // R5 — the pre-take priming framing the user saw; private correlation input.
  if (input.primingCondition) form.append("priming_condition", input.primingCondition);
  if (input.primingPhrase) form.append("priming_phrase", input.primingPhrase);
  // #191 — read-vs-spoken. A read carries the spoken session it re-reads
  // (paired) + its own fresh session id, so it links to the take without
  // counting as a new one. Omit all three for a normal spoken take.
  if (input.recordingKind) form.append("recording_kind", input.recordingKind);
  if (input.pairedSessionId) form.append("paired_session_id", input.pairedSessionId);
  if (input.guestSessionId) form.append("guest_session_id", input.guestSessionId);
  // FE-D — read-of-ideal-text tagging (flips the BE's reread_done for this
  // version and labels the coach fold "Re-read of ideal text vN").
  if (input.readTarget) form.append("read_target", input.readTarget);
  if (input.pairedSnippetId) form.append("paired_snippet_id", input.pairedSnippetId);
  if (typeof input.idealVersion === "number" && Number.isFinite(input.idealVersion)) {
    form.append("ideal_version", String(input.idealVersion));
  }
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
      message: "Couldn't reach the lab. Check your connection and try again.",
    };
  }

  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return {
      kind: "rejected",
      message:
        body?.error ??
        "That take was too short or had no clear speech, so let's try again.",
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
  if (res.status === 413) {
    // Bug 1 — the FE guard (validateAudioUpload) should catch this before the
    // request goes out; this is the fallback for anything that slips through
    // (a raw 413 from Vercel's ~4.5MB serverless body limit reads as a scary
    // generic failure otherwise).
    return {
      kind: "error",
      status: 413,
      message: "That file is too large to upload. Try a shorter audio file.",
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

  // Async analysis (delivery layer): 202 = { session_id, recording_id,
  // state:"processing", arc_id, take_index, take_count } — the daemon finishes
  // server-side; the FE polls the readout until ready/failed. Only an explicit
  // "processing" diverts here, so the legacy synchronous 201 path is untouched.
  if (
    (res.status === 202 || body.state === "processing") &&
    typeof body.session_id === "string" &&
    body.session_id.length > 0
  ) {
    return {
      kind: "processing",
      sessionId: body.session_id,
      arcId: typeof body.arc_id === "string" ? body.arc_id : null,
      takeIndex: typeof body.take_index === "number" ? body.take_index : null,
      takeCount: typeof body.take_count === "number" ? body.take_count : null,
    };
  }

  // BE A2 (verified live): 201 = { status, session_id, recording_id, state,
  // session_context, readout:{ snippets[] } }. Snippets sit at readout.snippets;
  // state defaults to readout_ready per the BE note.
  // Fold the BE's TOP-LEVEL audit_paid mirror into the readout object so the
  // arc-paid echo survives the extraction. (The coach layer is unconditionally
  // free now — no per-take withholding to thread through.)
  const readoutObj = {
    ...(body.readout && typeof body.readout === "object" ? body.readout : {}),
    ...("audit_paid" in body ? { audit_paid: body.audit_paid } : {}),
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

/* -------------------------------------------------------------------------- */
/*  guest readout re-read (bugs 4 & 6, BE-1) — GET /v2/lab/recordings/<id>/     */
/*  readout via the optional-auth BFF. Unlike the authed sessionReadout.ts      */
/*  service, this needs no token: an unclaimed session's own unguessable UUID   */
/*  is the capability. Used for (a) polling a fresh guest recording until its   */
/*  async Say It Stronger cards land, and (b) re-opening a guest's "Your        */
/*  Recording" bubble, which the authed re-read 401s on.                        */
/* -------------------------------------------------------------------------- */

export interface LabReadoutReread {
  state: string | null;
  readout: ReadoutPayload;
  /** FE-1 — top-level `setup` block (BE-1): the take's original intake context,
   *  used to restore setup for the next take (the guest endpoint is what
   *  unblocks a signed-out tester's take 2). null until the BE ships it. */
  setup: LabSessionContext | null;
}

/** Map the readout envelope — the JSON body GET …/readout returns AND the
 *  byte-identical `status` SSE event payload — into the FE shape. Shared by
 *  the fetch poll below and useLabReadoutLive so the two transports cannot
 *  drift. */
export function mapLabReadoutRereadBody(
  body: Record<string, unknown>
): LabReadoutReread {
  const readoutObj = {
    ...(body.readout && typeof body.readout === "object" ? body.readout : {}),
    ...("audit_paid" in body ? { audit_paid: body.audit_paid } : {}),
  };
  return {
    state: typeof body.state === "string" ? body.state : null,
    readout: mapReadoutPayload(readoutObj),
    setup: mapReadoutSetup(body.setup),
  };
}

export async function fetchGuestLabReadout(
  sessionId: string
): Promise<LabReadoutReread | null> {
  const token = await getAuthToken(); // forwarded when present; never required
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(
      `/api/v2/lab/recordings/${encodeURIComponent(sessionId)}/readout`,
      { headers, cache: "no-store" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return null;
  return mapLabReadoutRereadBody(body);
}
