/*
STORY    As the founder, I want the phone's wait after Stop reported in the
         background and never awaited, so that timing telemetry never slows
         or breaks practice.
OUTCOME
  O1  A failed upload sends no timing report.
  O2  A successful upload resolves with the practice while its timing report
      is still in flight, and the report names that attempt and both clocks.
  O3  A failing report neither throws nor rejects: it returns nothing to wait on.
PROVES   O1 -> "a failed upload reports nothing"
         O2 -> "a successful upload answers without waiting on its report"
         O3 -> "a failing report changes nothing"
WHY      V4 B1.4 (founder O5): the wait from Stop is measured, never awaited.
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { reportPractiseTiming, uploadConfidencePracticeAttempt } from "./confidentVoicePractice";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "token" }));

afterEach(() => vi.unstubAllGlobals());

const PRACTICE = {
  id: "p1",
  status: "open",
  exercise: { exercise_id: "e1", version: 1, title: "Slow down", instruction: "Say it slower." },
  passage: "We grew.",
  attempts: [
    { id: "a1", attempt_index: 1, audio_ref: "r1", duration_ms: 900, assessment: "Steadier." },
    { id: "a2", attempt_index: 2, audio_ref: "r2", duration_ms: 950, assessment: "Calmer." },
  ],
};

describe("V4 B1.4: the phone's wait from Stop is reported, never awaited", () => {

  it("a failed upload reports nothing", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await uploadConfidencePracticeAttempt("p1", new Blob(["x"]), 2, 1000);
    expect(out.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a successful upload answers without waiting on its report", async () => {
    const fetchMock = vi.fn((url: string) =>
      url.endsWith("/timing")
        ? new Promise<Response>(() => {}) // the report never answers
        : Promise.resolve(new Response(JSON.stringify({ practice: PRACTICE }), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await uploadConfidencePracticeAttempt("p1", new Blob(["x"]), 2, 1000);
    expect(out.ok && out.practice.id).toBe("p1");

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v2/user/confidence-practice/p1/attempts/a2/timing");
    expect(JSON.parse(String(init.body))).toMatchObject({ stopped_at_ms: 1000 });
  });

  it("a failing report changes nothing", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("offline"); });
    vi.stubGlobal("fetch", fetchMock);
    const returned = reportPractiseTiming(
      "p1", { attempts: [{ id: "a1", attemptIndex: 1 }] } as never, 1, 2,
    );
    expect(returned).toBeUndefined();
    // The report did run and fail; an escaped rejection would fail this file.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
