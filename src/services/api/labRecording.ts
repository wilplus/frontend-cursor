import { getAuthToken } from "@/lib/api/auth-client";
import { uploadProxyBase } from "@/lib/api/uploadProxy";
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
  /** Explicit project identity boundary. `new` always mints a fresh project;
   *  `continue` may only use the user-selected continueArcId. Omitted only by
   *  legacy/standalone callers. Decks, topics, and hashes never decide this. */
  projectIntent?: "new" | "continue";
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
  /** THE RETRY COLLAPSE's key — ONE PER RECORDING, minted by the caller when
   *  the audio is captured and reused for every attempt at sending it.
   *
   *  It used to be minted here, per CALL, which is not an idempotency key at
   *  all: the two lanes inside one call shared it (they share this form), but
   *  a caller-level retry built a fresh form, drew a fresh uuid, and the
   *  backend's collapse guard could never match. One recording then landed as
   *  takes N and N+1 with identical audio — which is the double take, and the
   *  reason the version badge jumps by two.
   *
   *  Absent → a fresh uuid, i.e. exactly the old behaviour, so a caller that
   *  has not been taught to hold a key still uploads. */
  uploadIdempotencyKey?: string;
  /** #191 — for a read, the spoken session this re-read belongs to. The BE links
   *  it to that take and it does NOT count as a new take. */
  pairedSessionId?: string;
  /** #191 — a fresh id so a read is its own session (the read never overwrites
   *  the spoken take). Sent for reads; omit for the spoken take. */
  guestSessionId?: string;
  /** DELIVERY_STARS (BE PR #222) — a snippet re-record's target snippet. The
   *  re-record IS a read on this endpoint: recording_kind "read" +
   *  paired_session_id (the take) + this. Flat field, same rule as above. */
  pairedSnippetId?: string;
}

export type LabUploadResult =
  | { kind: "ok"; sessionId: string | null; state: string | null; readout: ReadoutPayload; arcId: string | null; takeIndex: number | null; recordingProgress: RecordingProgress | null }
  /** Async analysis (delivery layer): the BE accepted the upload (202) — or its
   *  sync budget ran out (504 PROCESSING_TIMEOUT, handoff §A2: NOT a failure) —
   *  and the analysis finishes in the background. Poll the readout until
   *  `ready`/`failed`. Survives a closed tab / locked phone. */
  | { kind: "processing"; sessionId: string; arcId: string | null; takeIndex: number | null; takeCount: number | null }
  | { kind: "rejected"; message: string } // 422 — min-content gate
  /** `code` is the stable branch key (§A1 — never branch on `error` text);
   *  `ref` joins the generic copy to the real exception in backend logs and is
   *  already folded into `message` ("Reference: …") for display. */
  | { kind: "error"; status: number; message: string; code?: string; ref?: string };

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
  if (input.projectIntent === "new" && (input.arcId || input.continueArcId)) {
    return {
      ok: false,
      message: "Something went wrong on our end.",
    };
  }
  if (input.projectIntent === "continue") {
    if (!input.continueArcId) {
      return {
        ok: false,
        message: "Something went wrong on our end.",
      };
    }
    if (input.arcId && input.arcId !== input.continueArcId) {
      return {
        ok: false,
        message: "Something went wrong on our end.",
      };
    }
  }
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
    // A spoken take never reuses a session id — the BE mints one and the FE
    // adopts the returned `session_id` (a reused id is what made a new take
    // inherit the read's state).
    guestSessionId: _guest,
    ...spoken
  } = input;
  return { ok: true, input: spoken };
}

/** Successful uploads must echo the identity the request established. This is
 *  the FE's last fail-closed check: a malformed or stale server response may
 *  never silently move the UI onto another project's ideal text. */
export function projectIdentityError(
  input: Pick<LabUploadInput, "projectIntent" | "continueArcId">,
  returnedArcId: string | null
): string | null {
  if (!input.projectIntent) return null;
  if (!returnedArcId) return "The lab did not return a project id.";
  if (
    input.projectIntent === "continue" &&
    returnedArcId !== input.continueArcId
  ) {
    return "The lab returned a different project than the one selected.";
  }
  return null;
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
  if (input.projectIntent) form.append("project_intent", input.projectIntent);
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
  // F2 §2 — the same named state also rides the new closed-vocabulary lane
  // (named_emotion → intake_context → coach context + the internal drift
  // metric). One naming, two lanes: the BE normalizes against its vocabulary
  // and silently drops a key outside it ("unsure"), so this can never invent
  // an emotion the user didn't name.
  if (input.feeling) form.append("named_emotion", input.feeling);
  // R5 — the pre-take priming framing the user saw; private correlation input.
  if (input.primingCondition) form.append("priming_condition", input.primingCondition);
  if (input.primingPhrase) form.append("priming_phrase", input.primingPhrase);
  // #191 — read-vs-spoken. A read carries the spoken session it re-reads
  // (paired) + its own fresh session id, so it links to the take without
  // counting as a new one. Omit all three for a normal spoken take.
  if (input.recordingKind) form.append("recording_kind", input.recordingKind);
  if (input.pairedSessionId) form.append("paired_session_id", input.pairedSessionId);
  if (input.guestSessionId) form.append("guest_session_id", input.guestSessionId);
  if (input.pairedSnippetId) form.append("paired_snippet_id", input.pairedSnippetId);
  // Duration is measured server-side (A4 lists no audio_duration_sec field).

  // THE RETRY COLLAPSE (founder 2026-08-10, the double recording): one key
  // per TAKE, sent on BOTH lanes below. The Worker catch cannot tell "never
  // reached the backend" from "accepted, but our socket died", and the BFF
  // fallback then re-posts the same audio — the BE collapses the second
  // POST onto the first session by this key instead of minting take N+1.
  // Deliberately NOT guest_session_id: the spent-session guard rejects id
  // reuse by design, for a different bug.
  try {
    // The CALLER's key when it has one — the same recording keeps the same
    // key across every attempt, which is the only thing that makes the
    // backend's collapse guard reachable from a retry.
    form.append(
      "upload_idempotency_key",
      input.uploadIdempotencyKey || crypto.randomUUID()
    );
  } catch {
    // No crypto.randomUUID (ancient WebView) → no key → today's behavior.
  }

  const token = await getAuthToken(); // optional — public/guest endpoint
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  // Cloudflare Worker lane first when configured (no Vercel 300s ceiling, so
  // the backend's session_id-bearing 504 survives); BFF lane as the fallback
  // on any network-level failure — enabling the Worker can only degrade to
  // exactly today's behavior. FormData re-serializes per fetch, so the same
  // body object safely backs both attempts.
  const post = (url: string) =>
    fetch(url, {
      method: "POST",
      headers,
      body: form,
      credentials: "include",
    });

  let res: Response;
  try {
    const proxyBase = uploadProxyBase();
    let viaProxy: Response | null = null;
    if (proxyBase) {
      try {
        viaProxy = await post(`${proxyBase}/v2/lab/recordings`);
      } catch {
        viaProxy = null; // CORS, DNS, offline — fall back to the BFF lane.
      }
    }
    res = viaProxy ?? (await post("/api/v2/lab/recordings"));
  } catch {
    return {
      kind: "error",
      status: 0,
      message: "Couldn't reach the lab. Check your connection and try again.",
    };
  }

  // One parse for every branch. Error bodies are JSON everywhere now — the BE
  // returns JSON even for unknown routes and uncaught errors (handoff §A1) —
  // so a null here is a platform (non-BFF) response, e.g. a Vercel kill page.
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const bodyCode = typeof body?.code === "string" ? body.code : undefined;
  const bodyError =
    typeof body?.error === "string" && body.error.trim() ? body.error : undefined;
  const bodyRef = typeof body?.ref === "string" && body.ref ? body.ref : undefined;
  /** §A1 — `ref` is the join key to the real exception in backend logs; shown
   *  small + copyable so support can diagnose the generic copy. */
  const withRef = (message: string) =>
    bodyRef ? `${message} (Reference: ${bodyRef})` : message;
  const returnedArcId = typeof body?.arc_id === "string" ? body.arc_id : null;
  const identityFailure = (): LabUploadResult | null => {
    if (!projectIdentityError(input, returnedArcId)) return null;
    return {
      kind: "error",
      status: 502,
      code: "PROJECT_IDENTITY_MISMATCH",
      message: "Something went wrong on our end.",
    };
  };

  if (res.status === 422) {
    return {
      kind: "rejected",
      message:
        bodyError ??
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
      code: bodyCode,
      message:
        "Your recording is safe. This take is part of the full audit. Unlock it on the pricing page to continue.",
    };
  }
  if (res.status === 413) {
    // Bug 1 — the FE guard (validateAudioUpload) should catch this before the
    // request goes out; this is the fallback for anything that slips through
    // (a raw 413 from Vercel's ~4.5MB serverless body limit reads as a scary
    // generic failure otherwise). The BE now enforces the cap on real bytes
    // read (§A3), so this arrives as a clean FILE_TOO_LARGE instead of a
    // confusing downstream failure.
    return {
      kind: "error",
      status: 413,
      code: bodyCode,
      message: "That file is too large to upload. Try a shorter audio file.",
    };
  }
  // §A2 — the sync path's wall-clock budget ran out (BE 600s, or the BFF's own
  // abort). NOT a failure: the audio is stored and the session row exists.
  // With a session_id this is exactly the async-queue 202 — poll the readout.
  // Never "recording failed", never a re-record prompt: that would lose a take
  // that is still processing.
  if (res.status === 504 || bodyCode === "PROCESSING_TIMEOUT") {
    if (typeof body?.session_id === "string" && body.session_id.length > 0) {
      const identityError = identityFailure();
      if (identityError) return identityError;
      return {
        kind: "processing",
        sessionId: body.session_id,
        arcId: typeof body.arc_id === "string" ? body.arc_id : null,
        takeIndex: typeof body.take_index === "number" ? body.take_index : null,
        takeCount: typeof body.take_count === "number" ? body.take_count : null,
      };
    }
    // No session_id to poll (the BFF aborted before the BE could answer, or a
    // platform 504). Calm copy, no re-record prompt — the take is processing
    // server-side and lands in the library/lounge when done.
    return {
      kind: "error",
      status: 504,
      code: bodyCode ?? "PROCESSING_TIMEOUT",
      ref: bodyRef,
      message: withRef(
        bodyError ??
          "That recording is taking longer than expected — it's still processing, check back shortly."
      ),
    };
  }
  if (!res.ok) {
    // §A1 — `error` is safe, generic, human-readable copy now: render it
    // as-is. Branch on `code`/status only, never on the copy.
    return {
      kind: "error",
      status: res.status,
      code: bodyCode,
      ref: bodyRef,
      message: withRef(
        bodyError ?? `Analysis failed (HTTP ${res.status}). Try again in a moment.`
      ),
    };
  }

  if (!body) {
    return { kind: "error", status: res.status, message: "Empty response from the lab." };
  }

  const identityError = identityFailure();
  if (identityError) return identityError;

  // THE RETRY COLLAPSE echo (BE 2026-08-10): our other lane's POST already
  // landed this take — the BE matched the idempotency key and returned the
  // FIRST session instead of minting take N+1. Adopt it and poll; never a
  // second take.
  if (
    body.duplicate === true &&
    typeof body.session_id === "string" &&
    body.session_id.length > 0
  ) {
    return {
      kind: "processing",
      sessionId: body.session_id,
      arcId: typeof body.arc_id === "string" ? body.arc_id : null,
      takeIndex: typeof body.take_index === "number" ? body.take_index : null,
      takeCount: null,
    };
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
