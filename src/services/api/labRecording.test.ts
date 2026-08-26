import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Guest path — keep the uploader off the real auth client (browser storage).
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => Promise.resolve(null),
}));

import {
  guardRecordingInput,
  projectIdentityError,
  retryIdealTextGeneration,
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

describe("submitLabRecording — new-project background brief", () => {
  it("uploads the actual context document with Take 1", async () => {
    const brief = new File(["Revenue grew 18%."], "board-brief.txt", {
      type: "text/plain",
    });

    await submitLabRecording({
      ...baseInput(),
      contextDocument: brief,
    });

    const form = captured as FormData;
    const uploaded = form.get("context_document") as File;
    expect(uploaded).toBeInstanceOf(File);
    expect(uploaded.name).toBe("board-brief.txt");
    expect(await uploaded.text()).toBe("Revenue grew 18%.");
  });

  it("omits the field when no brief was selected", async () => {
    await submitLabRecording(baseInput());
    expect((captured as FormData).get("context_document")).toBeNull();
  });
});

describe("submitLabRecording — F2 §2 the named state rides both emotion lanes", () => {
  it("sends feeling AND named_emotion from the one captured value", async () => {
    await submitLabRecording({ ...baseInput(), feeling: "nervous" });
    const form = captured as FormData;

    expect(form.get("feeling")).toBe("nervous");
    expect(form.get("named_emotion")).toBe("nervous");
  });

  it("no naming → neither field arrives (never a null on the wire)", async () => {
    await submitLabRecording(baseInput());
    const form = captured as FormData;

    expect(form.get("feeling")).toBeNull();
    expect(form.get("named_emotion")).toBeNull();
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

  it("fails locally without either required identity coordinate", () => {
    expect(guardRecordingInput({ ...baseInput(), projectId: "" }).ok).toBe(
      false,
    );
    expect(
      guardRecordingInput({
        ...baseInput(),
        uploadIdempotencyKey: "",
      }).ok,
    ).toBe(false);
  });

  it("rejects a successful response that echoes the wrong project", async () => {
    stubResponse(201, {
      session_id: "sess_wrong",
      project_id: "arc-other",
      arc_id: "arc-other",
      state: "readout_ready",
      readout: { snippets: [] },
    });
    const res = await submitLabRecording({
      ...baseInput(),
      projectId: "arc-selected",
    });
    expect(res.kind).toBe("error");
    if (res.kind !== "error") throw new Error("unreachable");
    expect(res.code).toBe("PROJECT_IDENTITY_MISMATCH");
  });

  it("requires the backend to echo the exact selected project", () => {
    expect(projectIdentityError({ projectId: "project-1" }, null)).toContain(
      "did not return",
    );
    expect(
      projectIdentityError({ projectId: "project-1" }, "project-1"),
    ).toBeNull();
    expect(
      projectIdentityError({ projectId: "project-1" }, "project-2"),
    ).toContain("different project");
  });
});

describe("Take 1 Ideal Text confirmation boundary", () => {
  it("maps the exact terminal state without reporting upload success", async () => {
    stubResponse(200, {
      session_id: "sess_take_1",
      project_id: "arc_default",
      arc_id: "arc_default",
      take_index: 1,
      state: "failed_ideal_text_unconfirmed",
      analysis_state: "failed_ideal_text_unconfirmed",
      readout: null,
    });
    await expect(submitLabRecording(baseInput())).resolves.toEqual({
      kind: "ideal_text_unconfirmed",
      sessionId: "sess_take_1",
      arcId: "arc_default",
      takeIndex: 1,
    });
  });

  it("calls the document-only retry endpoint", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 202 } as Response),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(retryIdealTextGeneration("session one")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/lab/recordings/session%20one/retry-ideal-text",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
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
      "Something went wrong on our end. (Reference: a1b2c3d4)",
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

describe("submitLabRecording — response branch characterization", () => {
  it("keeps an accepted async upload in the processing state", async () => {
    stubResponse(202, {
      session_id: "sess_async",
      project_id: "arc_default",
      arc_id: "arc_default",
      take_index: 2,
      take_count: 2,
      state: "processing",
    });

    expect(await submitLabRecording(baseInput())).toEqual({
      kind: "processing",
      sessionId: "sess_async",
      arcId: "arc_default",
      takeIndex: 2,
      takeCount: 2,
    });
  });

  it("adopts an idempotency duplicate without incrementing take count", async () => {
    stubResponse(201, {
      duplicate: true,
      session_id: "sess_original",
      project_id: "arc_default",
      arc_id: "arc_default",
      take_index: 1,
      take_count: 2,
    });

    expect(await submitLabRecording(baseInput())).toEqual({
      kind: "processing",
      sessionId: "sess_original",
      arcId: "arc_default",
      takeIndex: 1,
      takeCount: null,
    });
  });

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

  it("maps an oversized upload to the specific 413 guidance", async () => {
    stubResponse(413, { code: "FILE_TOO_LARGE" });
    expect(await submitLabRecording(baseInput())).toEqual({
      kind: "error",
      status: 413,
      code: "FILE_TOO_LARGE",
      message: "That file is too large to upload. Try a shorter audio file.",
    });
  });

  it("reports an empty successful response explicitly", async () => {
    stubResponse(201, null);
    expect(await submitLabRecording(baseInput())).toEqual({
      kind: "error",
      status: 201,
      message: "Empty response from the lab.",
    });
  });

  it("maps a total network failure to the connection error", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")));
    expect(await submitLabRecording(baseInput())).toEqual({
      kind: "error",
      status: 0,
      message: "Couldn't reach the lab. Check your connection and try again.",
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  Cloudflare upload-proxy lane (founder 2026-08-04: no Vercel Pro, ever).    */
/*  NEXT_PUBLIC_UPLOAD_PROXY_URL set → the Worker is tried FIRST; any          */
/*  network-level failure falls back to the BFF lane, so enabling the Worker   */
/*  can only degrade to exactly the pre-Worker behavior. Unset → BFF only.     */
/* -------------------------------------------------------------------------- */

describe("submitLabRecording — Cloudflare upload-proxy routing", () => {
  const okBody = {
    session_id: "sess_1",
    project_id: "arc_default",
    arc_id: "arc_default",
    state: "readout_ready",
    readout: { snippets: [] },
  };
  const okResponse = () =>
    Promise.resolve({
      ok: true,
      status: 201,
      json: () => Promise.resolve(okBody),
    } as unknown as Response);

  afterEach(() => vi.unstubAllEnvs());

  it("posts to the Worker when the env is set (trailing slash trimmed)", async () => {
    vi.stubEnv("NEXT_PUBLIC_UPLOAD_PROXY_URL", "https://upload.example.com/");
    const urls: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      urls.push(url);
      return okResponse();
    });
    const res = await submitLabRecording(baseInput());
    expect(res.kind).toBe("ok");
    expect(urls).toEqual(["https://upload.example.com/v2/lab/recordings"]);
  });

  it("falls back to the BFF lane when the Worker is unreachable", async () => {
    vi.stubEnv("NEXT_PUBLIC_UPLOAD_PROXY_URL", "https://upload.example.com");
    const urls: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      urls.push(url);
      if (url.startsWith("https://upload.example.com")) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return okResponse();
    });
    const res = await submitLabRecording(baseInput());
    expect(res.kind).toBe("ok");
    expect(urls).toEqual([
      "https://upload.example.com/v2/lab/recordings",
      "/api/v2/lab/recordings",
    ]);
  });

  it("uses only the BFF lane when the env is unset", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      urls.push(url);
      return okResponse();
    });
    const res = await submitLabRecording(baseInput());
    expect(res.kind).toBe("ok");
    expect(urls).toEqual(["/api/v2/lab/recordings"]);
  });
});
