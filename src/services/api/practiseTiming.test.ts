import { afterEach, describe, expect, it, vi } from "vitest";
import { reportPractiseTiming, uploadConfidencePracticeAttempt } from "./confidentVoicePractice";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "token" }));

afterEach(() => vi.unstubAllGlobals());

describe("V4 B1.4: the phone's wait from Stop is reported, never awaited", () => {

  it("a failed upload reports nothing, and a failed report changes nothing", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await uploadConfidencePracticeAttempt("p1", new Blob(["x"]), 2, 1000);
    expect(out.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(() => reportPractiseTiming("p1", { attempts: [{ id: "a1", attemptIndex: 1 }] } as never, 1, 2)).not.toThrow();
  });
});
