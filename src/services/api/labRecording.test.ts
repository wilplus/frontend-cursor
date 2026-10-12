import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Guest path — keep the uploader off the real auth client (browser storage).
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => Promise.resolve(null),
}));

import {
  submitLabRecording,
} from "./labRecording";

/* -------------------------------------------------------------------------- */
/*  Locks the §S deck contract on the recording upload: when a deck is         */
/*  attached, `slides` / `presentation_ref` / `slide_advances` MUST ride the    */
/*  multipart body (and `slide_advances` serializes tMs → t_ms). This is the    */
/*  FE half the BE depends on to populate intake_context → the per-snippet      */
/*  `slide` in the readout. A rebuild of the set-up form that drops the wiring   */
/*  fails here instead of silently shipping deck-less recordings.               */
/* -------------------------------------------------------------------------- */

let captured: FormData | null = null;
let capturedHeaders: Headers;

beforeEach(() => {
  captured = null;
  capturedHeaders = new Headers();
  vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
    captured = init?.body as FormData;
    capturedHeaders = new Headers(init?.headers);
    return Promise.resolve({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          session_id: "sess_1",
          project_id: "arc_default",
          arc_id: "arc_default",
          state: "readout_ready",
          readout: { snippets: [] },
        }),
    } as unknown as Response);
  });
});

afterEach(() => vi.unstubAllGlobals());

const baseInput = () => ({
  audioBlob: new Blob(["fake-audio"], { type: "audio/webm" }),
  projectId: "arc_default",
  uploadIdempotencyKey: "upload-default",
  durationSec: 75,
  topic: "Q3 pitch",
});

describe("submitLabRecording — §S deck fields ride the multipart upload", () => {

  it("appends slides + presentation_ref + slide_advances when a deck is attached", async () => {
    const res = await submitLabRecording({
      ...baseInput(),
      slides: [
        {
          title: "Intro",
          body: "welcome",
          artworkSrc: "/presentation/default-deck/main-premise.jpg",
        },
        { title: "Problem", body: "pain point" },
      ],
      presentationRef: "https://pub-x.r2.dev/willab_presentations/abc.pdf",
      slideAdvances: [
        { index: 0, tMs: 0 },
        { index: 1, tMs: 4200 },
      ],
    });

    expect(res.kind).toBe("ok");
    expect(captured).not.toBeNull();
    const form = captured as FormData;

    expect(form.get("topic")).toBe("Q3 pitch");
    expect(form.get("presentation_ref")).toBe(
      "https://pub-x.r2.dev/willab_presentations/abc.pdf",
    );
    expect(JSON.parse(form.get("slides") as string)).toEqual([
      { title: "Intro", body: "welcome" },
      { title: "Problem", body: "pain point" },
    ]);
    // The tap timeline serializes camelCase tMs -> snake_case t_ms (BE contract).
    expect(JSON.parse(form.get("slide_advances") as string)).toEqual([
      { index: 0, t_ms: 0 },
      { index: 1, t_ms: 4200 },
    ]);
  });
});

describe("submitLabRecording — canonical project identity", () => {
  it("sends only the canonical project id and upload key", async () => {
    const res = await submitLabRecording({
      ...baseInput(),
      slides: [{ title: "shared default", body: "same content" }],
      presentationRef: null,
    });
    expect(res.kind).toBe("ok");
    const form = captured as FormData;
    expect(form.get("project_id")).toBe("arc_default");
    expect(form.get("upload_idempotency_key")).toBe("upload-default");
    expect(form.get("project_intent")).toBeNull();
    expect(form.get("arc_id")).toBeNull();
    expect(form.get("continue_arc_id")).toBeNull();
    expect(form.get("guest_session_id")).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  FE handoff 2026-08-03 §A — the new backend error envelope on the upload.   */
/*                                                                            */
/*  §A2: 504 PROCESSING_TIMEOUT is NOT a failure — audio stored, session row   */
/*  exists. With a session_id it must route into the SAME "processing" path    */
/*  as the async 202 (poll the readout); it must never read as "recording      */
/*  failed" and never prompt a re-record, which would lose a live take.        */
/*  §A1: `error` is safe generic copy now (render as-is), `ref` is the join    */
/*  key to backend logs, and branching happens on `code`, never on copy.       */
/* -------------------------------------------------------------------------- */

function stubResponse(status: number, body: unknown) {
  vi.stubGlobal("fetch", () =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () =>
        body === null
          ? Promise.reject(new Error("not json"))
          : Promise.resolve(body),
    } as unknown as Response),
  );
}

describe("submitLabRecording — §A2 PROCESSING_TIMEOUT is still-processing, not failure", () => {
  it("routes a 504 with session_id into the async 'processing' path", async () => {
    stubResponse(504, {
      code: "PROCESSING_TIMEOUT",
      error:
        "That recording is taking longer than expected — it's still processing, check back shortly.",
      session_id: "sess_504",
      project_id: "arc_default",
      arc_id: "arc_default",
    });
    const res = await submitLabRecording(baseInput());
    expect(res).toEqual({
      kind: "processing",
      sessionId: "sess_504",
      arcId: "arc_default",
      takeIndex: null,
      takeCount: null,
    });
  });
});

describe("submitLabRecording — response branch characterization", () => {

  it("keeps 402 out of the analysis-failed path", async () => {
    stubResponse(402, { code: "PAYMENT_REQUIRED" });
    const result = await submitLabRecording(baseInput());

    expect(result).toMatchObject({
      kind: "error",
      status: 402,
      code: "PAYMENT_REQUIRED",
    });
    if (result.kind !== "error") throw new Error("unreachable");
    expect(result.message).toContain("recording is safe");
  });
});

/* -------------------------------------------------------------------------- */
/*  THE DOUBLE TAKE (founder 2026-08-12)                                       */
/*                                                                            */
/*  "It really is double analysing the text — this even shows in the chat      */
/*  history that it jumps from 2.0 to 4.0 and there are two recordings there." */
/*                                                                            */
/*  One recording, two takes. The backend has had a collapse guard for this    */
/*  since 2026-08-10 — same `upload_idempotency_key` means same take, echo the */
/*  first session and store nothing twice — and it could never fire, because   */
/*  the key was minted INSIDE the API helper with crypto.randomUUID(). The two */
/*  lanes of one call shared it (they share the form), but a caller-level      */
/*  RETRY built a fresh form, drew a fresh uuid, and the backend correctly     */
/*  minted take N+1 for audio it already had.                                  */
/*                                                                            */
/*  A key generated per attempt is not an idempotency key. It has to be a      */
/*  property of the RECORDING, and the two rules below are what make it one.   */
/* -------------------------------------------------------------------------- */

const API = readFileSync("src/services/api/labRecording.ts", "utf8");

/* -------------------------------------------------------------------------- */
/*  DISCARDING A TAKE THAT IS STILL GOING UP (founder 2026-09-16)              */
/*                                                                            */
/*  The only window in which a take can leave NO SERVER TRACE is while its     */
/*  request is in flight. These pin the three ways that promise could quietly  */
/*  break: reporting the abort as a network error (which offers a retry that   */
/*  would re-send the discarded audio), re-posting it on the BFF lane through  */
/*  the proxy fallback, and claiming a discard for a take the server already   */
/*  answered for.                                                             */
/* -------------------------------------------------------------------------- */
describe("submitLabRecording — an aborted upload is a discard, not a failure", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports `discarded`, never the connection-error copy", async () => {
    const abort = new AbortController();
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      // A real browser rejects an aborted fetch; the name differs by engine,
      // which is exactly why the helper reads the SIGNAL and not the error.
      init?.signal?.addEventListener("abort", () => undefined);
      abort.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    const res = await submitLabRecording(baseInput(), { signal: abort.signal });
    expect(res.kind).toBe("discarded");
  });

  it("does NOT re-send the discarded take down the BFF lane", async () => {
    // The proxy fallback exists for CORS/DNS/offline failures. Reusing it on a
    // deliberate abort would upload the very recording just thrown away — and
    // to a URL that never saw the abort.
    vi.stubEnv("NEXT_PUBLIC_UPLOAD_PROXY_URL", "https://upload.example.com");
    const abort = new AbortController();
    const urls: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      urls.push(url);
      abort.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    const res = await submitLabRecording(baseInput(), { signal: abort.signal });
    expect(res.kind).toBe("discarded");
    expect(urls).toEqual(["https://upload.example.com/v2/lab/recordings"]);
  });
});
