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
