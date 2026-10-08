import { afterEach, describe, expect, it, vi } from "vitest";
import { reportPractiseTiming, uploadConfidencePracticeAttempt } from "./confidentVoicePractice";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "token" }));

const practiceJson = {
  practice: {
    id: "p1", status: "open", passage: "We grew.",
    exercise: { exercise_id: "e1", version: 1, title: "t", instruction: "i" },
    attempts: [
      { id: "a1", attempt_index: 1, audio_ref: "r1", duration_ms: 1000, assessment: "x" },
      { id: "a2", attempt_index: 2, audio_ref: "r2", duration_ms: 1000, assessment: "x" },
    ],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("V4 B1.4: the phone's wait from Stop is reported, never awaited", () => {
  it("posts Stop and shown times for the latest try after the upload answers", async () => {
    const calls: Array<[string, RequestInit]> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify(practiceJson), { status: 201 });
    }));
    const out = await uploadConfidencePracticeAttempt("p1", new Blob(["x"]), 2, 1000);
    expect(out.ok).toBe(true);
    await vi.waitFor(() => expect(calls.length).toBe(2));
    const [url, init] = calls[1];
    expect(url).toBe("/api/v2/user/confidence-practice/p1/attempts/a2/timing");
    const body = JSON.parse(String(init.body));
    expect(body.stopped_at_ms).toBe(1000);
    expect(body.shown_at_ms).toBeGreaterThanOrEqual(1000);
    expect(Object.keys(body).sort()).toEqual(["shown_at_ms", "stopped_at_ms"]);
  });

  it("a failed upload reports nothing, and a failed report changes nothing", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await uploadConfidencePracticeAttempt("p1", new Blob(["x"]), 2, 1000);
    expect(out.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(() => reportPractiseTiming("p1", { attempts: [{ id: "a1", attemptIndex: 1 }] } as never, 1, 2)).not.toThrow();
  });

  it("a clock that ran backwards sends nothing", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    reportPractiseTiming("p1", { attempts: [{ id: "a1", attemptIndex: 1 }] } as never, 5000, 4000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
