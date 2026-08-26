import { getAuthToken } from "@/lib/api/auth-client";
import { uploadProxyBase } from "@/lib/api/uploadProxy";
import {
  mapReadoutPayload,
  type ReadoutPayload,
} from "@/components/willab/readout";
import {
  mapRecordingProgress,
  type RecordingProgress,
} from "./recordingProgress";
import { type PresentationSlide } from "@/components/willab/presentation";
import { type Feeling } from "@/components/willab/willabFeelings";
import { mapReadoutSetup } from "@/components/willab/willabLastSetup";
import { type LabSessionContext } from "@/components/willab/LabOverlay";
import { guestOwnerHeaders } from "./projects";

/* -------------------------------------------------------------------------- */
/*  labRecording — the Lab upload client (seam ③, §3.3)                        */
/*                                                                            */
/*  POST /api/v2/lab/recordings — multipart, SYNCHRONOUS (~3–5s): 201 + the    */
/*  finished Readout, or 422 (min-content gate → re-record). Public/guest:     */
/*  the token is forwarded when signed (for scoping) but never required.       */
/* -------------------------------------------------------------------------- */

export interface LabUploadInput {
  audioBlob: Blob;
  /** Immutable canonical project selected or created before this upload. */
  projectId: string;
  /** One key per captured take, reused unchanged for every network retry. */
  uploadIdempotencyKey: string;
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
  /** Optional background brief for a newly created project. Verbal feedback
   *  may use its facts, but it is never copied into the speaker's Ideal Text. */
  contextDocument?: File;
  /** Tap timeline — which slide was advanced to, at t_ms from record start. */
  slideAdvances?: { index: number; tMs: number }[];
  /** F1 — ms to SUBTRACT from every slideAdvances[].tMs to convert UI time to
   *  AUDIO time: `t_recorderFirstAudio - t_zeroUsedForTapTimes`. The recorder
   *  warms up after start(), so audio runs behind the UI clock and the first
   *  words after a tap would otherwise bucket to the PREVIOUS slide. Measured
   *  per take, normally small and positive. Omitted when unmeasurable, which
   *  leaves the BE on exactly its previous behaviour. */
  slideClockOffsetMs?: number;
  /** Pre-recording feeling — private correlation input (AC-9, never shown back). */
  feeling?: Feeling;
  /** #191 — "spoken" (the take itself) vs "read" (a re-read of a piece's
   *  corrected text). Default/omitted = spoken (the BE's default). */
  recordingKind?: "spoken" | "read";
  /** #191 — for a read, the spoken session this re-read belongs to. The BE links
   *  it to that take and it does NOT count as a new take. */
  pairedSessionId?: string;
  /** DELIVERY_STARS (BE PR #222) — a snippet re-record's target snippet. The
   *  re-record IS a read on this endpoint: recording_kind "read" +
   *  paired_session_id (the take) + this. Flat field, same rule as above. */
  pairedSnippetId?: string;
}

export type LabUploadResult =
  | {
      kind: "ok";
      sessionId: string | null;
      state: string | null;
      readout: ReadoutPayload;
      arcId: string | null;
      takeIndex: number | null;
      recordingProgress: RecordingProgress | null;
    }
  /** Async analysis (delivery layer): the BE accepted the upload (202) — or its
   *  sync budget ran out (504 PROCESSING_TIMEOUT, handoff §A2: NOT a failure) —
   *  and the analysis finishes in the background. Poll the readout until
   *  `ready`/`failed`. Survives a closed tab / locked phone. */
  | {
      kind: "processing";
      sessionId: string;
      arcId: string | null;
      takeIndex: number | null;
      takeCount: number | null;
    }
  | {
      kind: "ideal_text_unconfirmed";
      sessionId: string;
      arcId: string;
      takeIndex: 1;
    }
  | { kind: "rejected"; message: string } // 422 — min-content gate
  /** `code` is the stable branch key (§A1 — never branch on `error` text);
   *  `ref` joins the generic copy to the real exception in backend logs and is
   *  already folded into `message` ("Reference: …") for display. */
  | {
      kind: "error";
      status: number;
      message: string;
      code?: string;
      ref?: string;
    };

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
  input: LabUploadInput,
): { ok: true; input: LabUploadInput } | { ok: false; message: string } {
  if (
    typeof input.projectId !== "string" ||
    !input.projectId.trim() ||
    typeof input.uploadIdempotencyKey !== "string" ||
    !input.uploadIdempotencyKey.trim()
  ) {
    return {
      ok: false,
      message: "Something went wrong on our end.",
    };
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
    ...spoken
  } = input;
  return { ok: true, input: spoken };
}

/** Successful uploads must echo the identity the request established. This is
 *  the FE's last fail-closed check: a malformed or stale server response may
 *  never silently move the UI onto another project's ideal text. */
export function projectIdentityError(
  input: Pick<LabUploadInput, "projectId">,
  returnedProjectId: string | null,
): string | null {
  if (!returnedProjectId) return "The lab did not return a project id.";
  if (returnedProjectId !== input.projectId) {
    return "The lab returned a different project than the one selected.";
  }
  return null;
}

type LabResponseBody = Record<string, unknown> | null;

interface LabResponseContext {
  body: LabResponseBody;
  code: string | undefined;
  error: string | undefined;
  ref: string | undefined;
}

function appendPresentFields(
  form: FormData,
  fields: Array<[name: string, value: string | null | undefined]>,
): void {
  for (const [name, value] of fields) {
    if (value) form.append(name, value);
  }
}

function appendJsonArray<T>(
  form: FormData,
  name: string,
  values: T[] | undefined,
): void {
  if (values && values.length > 0) {
    form.append(name, JSON.stringify(values));
  }
}

function appendDeckContext(form: FormData, input: LabUploadInput): void {
  // UI-only default-deck artwork never becomes backend state. This explicit
  // projection keeps the wire contract canonical even when the recorder is
  // rendering the richer deckless mock.
  const structuralSlides = input.slides?.map(({ title, body }) => ({
    title,
    body,
  }));
  appendJsonArray(form, "slides", structuralSlides);
  appendPresentFields(form, [["presentation_ref", input.presentationRef]]);

  const strategicContext = input.strategicContext?.trim();
  if (strategicContext) {
    form.append("strategic_context", strategicContext);
  }
  if (input.contextDocument) {
    form.append(
      "context_document",
      input.contextDocument,
      input.contextDocument.name,
    );
  }
  if (input.slideAdvances && input.slideAdvances.length > 0) {
    form.append(
      "slide_advances",
      JSON.stringify(
        input.slideAdvances.map((advance) => ({
          index: advance.index,
          t_ms: advance.tMs,
        })),
      ),
    );
  }
  if (
    typeof input.slideClockOffsetMs === "number" &&
    Number.isFinite(input.slideClockOffsetMs)
  ) {
    form.append(
      "slide_clock_offset_ms",
      String(Math.round(input.slideClockOffsetMs)),
    );
  }
}

function appendProjectContext(form: FormData, input: LabUploadInput): void {
  form.append("project_id", input.projectId);

  if (input.feeling) {
    form.append("feeling", input.feeling);
    form.append("named_emotion", input.feeling);
  }
  appendPresentFields(form, [
    ["recording_kind", input.recordingKind],
    ["paired_session_id", input.pairedSessionId],
    ["paired_snippet_id", input.pairedSnippetId],
  ]);
}

function appendIdempotencyKey(form: FormData, input: LabUploadInput): void {
  form.append("upload_idempotency_key", input.uploadIdempotencyKey);
}

function buildLabUploadForm(input: LabUploadInput): FormData {
  const form = new FormData();
  form.append("audio_file", input.audioBlob, "lab.webm");
  form.append("topic", input.topic);
  appendPresentFields(form, [["audience", input.audience]]);

  if (input.targetLengthSeconds != null) {
    form.append("target_length_seconds", String(input.targetLengthSeconds));
  }
  appendJsonArray(form, "domain_vocabulary", input.domainVocabulary);
  appendDeckContext(form, input);
  appendProjectContext(form, input);
  appendIdempotencyKey(form, input);
  return form;
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: "Bearer " + token } : {};
}

async function postLabUpload(
  form: FormData,
  headers: Record<string, string>,
): Promise<Response> {
  const post = (url: string) =>
    fetch(url, {
      method: "POST",
      headers,
      body: form,
      credentials: "include",
    });

  const proxyBase = uploadProxyBase();
  if (!proxyBase) return post("/api/v2/lab/recordings");

  try {
    return await post(proxyBase + "/v2/lab/recordings");
  } catch {
    // CORS, DNS, or an offline Worker falls back to the existing BFF lane.
    return post("/api/v2/lab/recordings");
  }
}

function responseContext(body: LabResponseBody): LabResponseContext {
  return {
    body,
    code: typeof body?.code === "string" ? body.code : undefined,
    error:
      typeof body?.error === "string" && body.error.trim()
        ? body.error
        : undefined,
    ref: typeof body?.ref === "string" && body.ref ? body.ref : undefined,
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function hasSessionId(body: LabResponseBody): body is Record<string, unknown> {
  return (
    !!body && typeof body.session_id === "string" && body.session_id.length > 0
  );
}

function withResponseRef(message: string, ref: string | undefined): string {
  return ref ? message + " (Reference: " + ref + ")" : message;
}

function projectIdentityFailure(
  input: LabUploadInput,
  body: LabResponseBody,
): LabUploadResult | null {
  const returnedProjectId = stringOrNull(body?.project_id);
  if (!projectIdentityError(input, returnedProjectId)) return null;
  return {
    kind: "error",
    status: 502,
    code: "PROJECT_IDENTITY_MISMATCH",
    message: "Something went wrong on our end.",
  };
}

function processingResult(
  body: Record<string, unknown>,
  takeCount: number | null,
): LabUploadResult {
  return {
    kind: "processing",
    sessionId: body.session_id as string,
    arcId: stringOrNull(body.arc_id),
    takeIndex: numberOrNull(body.take_index),
    takeCount,
  };
}

function isProcessingTimeout(
  response: Response,
  code: string | undefined,
): boolean {
  return response.status === 504 || code === "PROCESSING_TIMEOUT";
}

function mapProcessingTimeout(
  input: LabUploadInput,
  context: LabResponseContext,
): LabUploadResult {
  const { body, code, error, ref } = context;
  if (hasSessionId(body)) {
    const identityError = projectIdentityFailure(input, body);
    return (
      identityError ?? processingResult(body, numberOrNull(body.take_count))
    );
  }
  return {
    kind: "error",
    status: 504,
    code: code ?? "PROCESSING_TIMEOUT",
    ref,
    message: withResponseRef(
      error ??
        "That recording is taking longer than expected — it's still processing, check back shortly.",
      ref,
    ),
  };
}

function mapUnhandledHttpError(
  response: Response,
  context: LabResponseContext,
): LabUploadResult {
  const { code, error, ref } = context;
  return {
    kind: "error",
    status: response.status,
    code,
    ref,
    message: withResponseRef(
      error ??
        "Analysis failed (HTTP " +
          response.status +
          "). Try again in a moment.",
      ref,
    ),
  };
}

function mapLabFailure(
  input: LabUploadInput,
  response: Response,
  context: LabResponseContext,
): LabUploadResult | null {
  const { code, error } = context;
  if (response.status === 422) {
    return {
      kind: "rejected",
      message:
        error ??
        "That take was too short or had no clear speech, so let's try again.",
    };
  }
  if (response.status === 402) {
    return {
      kind: "error",
      status: 402,
      code,
      message:
        "Your recording is safe. This take is part of the full audit. Unlock it on the pricing page to continue.",
    };
  }
  if (response.status === 413) {
    return {
      kind: "error",
      status: 413,
      code,
      message: "That file is too large to upload. Try a shorter audio file.",
    };
  }
  if (isProcessingTimeout(response, code)) {
    return mapProcessingTimeout(input, context);
  }
  if (!response.ok) return mapUnhandledHttpError(response, context);
  return null;
}

function readoutObject(body: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(body.readout && typeof body.readout === "object" ? body.readout : {}),
    ...("audit_paid" in body ? { audit_paid: body.audit_paid } : {}),
  };
}

function readoutState(value: unknown): string {
  return typeof value === "string" ? value : "readout_ready";
}

function mapSuccessfulLabUpload(
  input: LabUploadInput,
  response: Response,
  body: Record<string, unknown>,
): LabUploadResult {
  const identityError = projectIdentityFailure(input, body);
  if (identityError) return identityError;

  if (
    body.state === "failed_ideal_text_unconfirmed" &&
    hasSessionId(body) &&
    typeof body.arc_id === "string" &&
    body.arc_id.length > 0
  ) {
    return {
      kind: "ideal_text_unconfirmed",
      sessionId: body.session_id as string,
      arcId: body.arc_id,
      takeIndex: 1,
    };
  }

  // An idempotency duplicate adopts the first session and never increments the
  // visible take count.
  if (body.duplicate === true && hasSessionId(body)) {
    return processingResult(body, null);
  }
  if (
    (response.status === 202 || body.state === "processing") &&
    hasSessionId(body)
  ) {
    return processingResult(body, numberOrNull(body.take_count));
  }

  return {
    kind: "ok",
    sessionId: stringOrNull(body.session_id),
    state: readoutState(body.state),
    readout: mapReadoutPayload(readoutObject(body)),
    arcId: stringOrNull(body.arc_id),
    takeIndex: numberOrNull(body.take_index),
    recordingProgress: mapRecordingProgress(body.recording_progress),
  };
}

function mapLabUploadResponse(
  input: LabUploadInput,
  response: Response,
  body: LabResponseBody,
): LabUploadResult {
  const failure = mapLabFailure(input, response, responseContext(body));
  if (failure) return failure;
  if (!body) {
    return {
      kind: "error",
      status: response.status,
      message: "Empty response from the lab.",
    };
  }
  return mapSuccessfulLabUpload(input, response, body);
}

export async function submitLabRecording(
  rawInput: LabUploadInput,
): Promise<LabUploadResult> {
  const guard = guardRecordingInput(rawInput);
  if (!guard.ok) return { kind: "rejected", message: guard.message };

  const input = guard.input;
  const form = buildLabUploadForm(input);
  const token = await getAuthToken();
  const headers = {
    ...authHeaders(token),
    ...(token ? {} : guestOwnerHeaders()),
  };

  let response: Response;
  try {
    response = await postLabUpload(form, headers);
  } catch {
    return {
      kind: "error",
      status: 0,
      message: "Couldn't reach the lab. Check your connection and try again.",
    };
  }

  const body = (await response.json().catch(() => null)) as LabResponseBody;
  return mapLabUploadResponse(input, response, body);
}

/* -------------------------------------------------------------------------- */
/*  guest readout re-read — GET /v2/lab/recordings/<id>/readout via the        */
/*  optional-auth BFF. A guest proves canonical ownership with its signed       */
/*  Guest ID; a UUID by itself is never access. Used for (a) polling until its  */
/*  async Say It Stronger cards land, and (b) re-opening a guest's "Your        */
/*  Recording" bubble, which the authed re-read 401s on.                        */
/* -------------------------------------------------------------------------- */

export interface LabReadoutReread {
  state: string | null;
  readout: ReadoutPayload;
  processing: { stage: string; percent: number } | null;
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
  body: Record<string, unknown>,
): LabReadoutReread {
  const readoutObj = {
    ...(body.readout && typeof body.readout === "object" ? body.readout : {}),
    ...("audit_paid" in body ? { audit_paid: body.audit_paid } : {}),
  };
  return {
    state: typeof body.state === "string" ? body.state : null,
    readout: mapReadoutPayload(readoutObj),
    setup: mapReadoutSetup(body.setup),
    processing:
      body.processing && typeof body.processing === "object"
        ? (() => {
            const raw = body.processing as Record<string, unknown>;
            if (typeof raw.stage !== "string") return null;
            const percent =
              typeof raw.percent === "number" && Number.isFinite(raw.percent)
                ? Math.max(0, Math.min(100, Math.round(raw.percent)))
                : 0;
            return { stage: raw.stage, percent };
          })()
        : null,
  };
}

export async function fetchGuestLabReadout(
  sessionId: string,
): Promise<LabReadoutReread | null> {
  const token = await getAuthToken(); // forwarded when present; never required
  const headers: Record<string, string> = token ? {} : guestOwnerHeaders();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(
      `/api/v2/lab/recordings/${encodeURIComponent(sessionId)}/readout`,
      { headers, cache: "no-store" },
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return null;
  return mapLabReadoutRereadBody(body);
}

/** Restart analysis against the already-uploaded recording. */
export async function retryLabProcessing(sessionId: string): Promise<boolean> {
  const token = await getAuthToken();
  try {
    const headers: Record<string, string> = token ? {} : guestOwnerHeaders();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(
      `/api/v2/lab/recordings/${encodeURIComponent(sessionId)}/retry-processing`,
      {
        method: "POST",
        headers,
        cache: "no-store",
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

/** Retry only Take 1 Ideal Text generation from stored analysis artifacts. */
export async function retryIdealTextGeneration(
  sessionId: string,
): Promise<boolean> {
  const token = await getAuthToken();
  try {
    const headers: Record<string, string> = token ? {} : guestOwnerHeaders();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(
      `/api/v2/lab/recordings/${encodeURIComponent(sessionId)}/retry-ideal-text`,
      {
        method: "POST",
        headers,
        cache: "no-store",
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}
