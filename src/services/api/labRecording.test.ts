import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Guest path — keep the uploader off the real auth client (browser storage).
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => Promise.resolve(null),
}));

import { submitLabRecording } from "./labRecording";

/* -------------------------------------------------------------------------- */
/*  Locks the §S deck contract on the recording upload: when a deck is         */
/*  attached, `slides` / `presentation_ref` / `slide_advances` MUST ride the    */
/*  multipart body (and `slide_advances` serializes tMs → t_ms). This is the    */
/*  FE half the BE depends on to populate intake_context → the per-snippet      */
/*  `slide` in the readout. A rebuild of the set-up form that drops the wiring   */
/*  fails here instead of silently shipping deck-less recordings.               */
/* -------------------------------------------------------------------------- */

let captured: FormData | null = null;

beforeEach(() => {
  captured = null;
  vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
    captured = init?.body as FormData;
    return Promise.resolve({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          session_id: "sess_1",
          state: "readout_ready",
          readout: { snippets: [] },
        }),
    } as unknown as Response);
  });
});

afterEach(() => vi.unstubAllGlobals());

const baseInput = () => ({
  audioBlob: new Blob(["fake-audio"], { type: "audio/webm" }),
  durationSec: 75,
  topic: "Q3 pitch",
});

describe("submitLabRecording — §S deck fields ride the multipart upload", () => {
  it("appends slides + presentation_ref + slide_advances when a deck is attached", async () => {
    const res = await submitLabRecording({
      ...baseInput(),
      slides: [
        { title: "Intro", body: "welcome" },
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
      "https://pub-x.r2.dev/willab_presentations/abc.pdf"
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

  it("omits the deck fields when training without slides (deck optional)", async () => {
    await submitLabRecording(baseInput());
    const form = captured as FormData;

    expect(form.get("topic")).toBe("Q3 pitch");
    expect(form.get("slides")).toBeNull();
    expect(form.get("presentation_ref")).toBeNull();
    expect(form.get("slide_advances")).toBeNull();
  });

  it("omits empty deck arrays (no slides / no taps → no fields)", async () => {
    await submitLabRecording({
      ...baseInput(),
      slides: [],
      presentationRef: null,
      slideAdvances: [],
    });
    const form = captured as FormData;

    expect(form.get("slides")).toBeNull();
    expect(form.get("presentation_ref")).toBeNull();
    expect(form.get("slide_advances")).toBeNull();
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
        body === null ? Promise.reject(new Error("not json")) : Promise.resolve(body),
    } as unknown as Response)
  );
}

describe("submitLabRecording — §A2 PROCESSING_TIMEOUT is still-processing, not failure", () => {
  it("routes a 504 with session_id into the async 'processing' path", async () => {
    stubResponse(504, {
      code: "PROCESSING_TIMEOUT",
      error:
        "That recording is taking longer than expected — it's still processing, check back shortly.",
      session_id: "sess_504",
    });
    const res = await submitLabRecording(baseInput());
    expect(res).toEqual({
      kind: "processing",
      sessionId: "sess_504",
      arcId: null,
      takeIndex: null,
      takeCount: null,
    });
  });

  it("keeps a session-less 504 calm: PROCESSING_TIMEOUT code, no failure copy", async () => {
    stubResponse(504, {
      code: "PROCESSING_TIMEOUT",
      error:
        "That recording is taking longer than expected — it's still processing, check back shortly.",
    });
    const res = await submitLabRecording(baseInput());
    expect(res.kind).toBe("error");
    if (res.kind !== "error") throw new Error("unreachable");
    expect(res.code).toBe("PROCESSING_TIMEOUT");
    expect(res.message).toContain("still processing");
    expect(res.message).not.toContain("failed");
  });

  it("treats even a bodyless platform 504 as still-processing (never 'Analysis failed')", async () => {
    stubResponse(504, null); // e.g. an HTML timeout page — json() rejects
    const res = await submitLabRecording(baseInput());
    expect(res.kind).toBe("error");
    if (res.kind !== "error") throw new Error("unreachable");
    expect(res.code).toBe("PROCESSING_TIMEOUT");
    expect(res.message).toContain("still processing");
  });
});

describe("submitLabRecording — §A1 generic error copy + ref", () => {
  it("renders the backend's safe copy as-is and folds in the ref join key", async () => {
    stubResponse(500, {
      code: "V2_ERROR",
      error: "Something went wrong on our end.",
      ref: "a1b2c3d4",
    });
    const res = await submitLabRecording(baseInput());
    expect(res.kind).toBe("error");
    if (res.kind !== "error") throw new Error("unreachable");
    expect(res.code).toBe("V2_ERROR");
    expect(res.ref).toBe("a1b2c3d4");
    expect(res.message).toBe(
      "Something went wrong on our end. (Reference: a1b2c3d4)"
    );
  });

  it("falls back to the FE copy when a non-BFF response has no JSON body", async () => {
    stubResponse(502, null);
    const res = await submitLabRecording(baseInput());
    expect(res.kind).toBe("error");
    if (res.kind !== "error") throw new Error("unreachable");
    expect(res.message).toContain("Analysis failed (HTTP 502)");
  });
});
