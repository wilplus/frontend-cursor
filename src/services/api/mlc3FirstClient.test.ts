import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "token",
}));

import {
  uploadServicePracticeAttempt,
  type ServicePracticeSession,
} from "./mlc3FirstClient";

afterEach(() => vi.unstubAllGlobals());

describe("first-client practice upload recovery", () => {
  it("replays the exact request after a committed response is lost", async () => {
    const calls: RequestInit[] = [];
    let count = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(init);
      count += 1;
      if (count === 1) throw new TypeError("response lost");
      return new Response(JSON.stringify({
        attempt_id: "attempt-1",
        attempt_index: 1,
        audio_ref: "/audio/attempt-1",
        duration_ms: 1200,
        transcript_state: "ready",
        validity: "valid",
        reason_codes: [],
        selection_state: "selected",
        selected_attempt_id: "attempt-1",
        owner_pair: null,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const session: ServicePracticeSession = {
      id: "session-1",
      exactPassage: "A precise sentence.",
      sourceOfferId: "offer-1",
      exerciseVersionId: "exercise-1",
      contentIdentitySha256: "a".repeat(64),
      state: "open",
    };
    const audio = new Blob(["audio"], { type: "audio/webm" });
    const args = [
      session, audio, "render-1", "2026-09-09T10:00:00.000Z",
      "2026-09-09T10:00:01.000Z", "capture-idempotency-1",
    ] as const;

    expect((await uploadServicePracticeAttempt(...args)).ok).toBe(false);
    expect((await uploadServicePracticeAttempt(...args)).ok).toBe(true);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect((call.headers as Record<string, string>)["Idempotency-Key"])
        .toBe("capture-idempotency-1");
      const form = call.body as FormData;
      expect(form.has("attempt_index")).toBe(false);
      expect(form.get("capture_started_at"))
        .toBe("2026-09-09T10:00:00.000Z");
      expect(form.get("capture_completed_at"))
        .toBe("2026-09-09T10:00:01.000Z");
      expect(form.get("audio")).toBeInstanceOf(Blob);
    }
  });
});
