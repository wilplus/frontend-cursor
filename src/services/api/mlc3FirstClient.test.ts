import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "token",
}));

import {
  confirmPracticeSelfSpeaker,
  confirmSourceSelfSpeaker,
  uploadServicePracticeAttempt,
  type ServiceFeedbackIdentity,
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

describe("general-service self-speaker routing", () => {
  const identity: ServiceFeedbackIdentity = {
    projectId: "project-1",
    takeId: "take-1",
    membershipId: "membership-1",
    candidateId: "candidate-1",
    feedbackExposureId: "exposure-1",
    contentIdentitySha256: "a".repeat(64),
    n1CandidateSetId: "candidate-set-1",
    authorizationCheckId: "authorization-1",
    sourceAcquisitionReceiptId: "receipt-1",
  };

  it("submits only the exact affirmative source action", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => (
      new Response(JSON.stringify({
        assertion_id: "assertion-1",
        speaker_id: "speaker-1",
        target_binding_id: "binding-1",
        replayed: false,
        meaning: "identity_routing_only",
        dataset_eligible: false,
      }), { status: 201, headers: { "Content-Type": "application/json" } })
    ));
    vi.stubGlobal("fetch", fetchMock);
    const result = await confirmSourceSelfSpeaker(identity, "source-speaker-1");
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v2/user/mlc3/feedback/speaker");
    expect(JSON.parse(String(init.body))).toEqual({
      membership_id: "membership-1",
      candidate_id: "candidate-1",
      assertion: "this_is_my_voice",
    });
  });

  it("requires same-speaker eligibility before mapping an owner pair", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      speaker_target: {
        assertion_id: "assertion-2",
        speaker_id: "speaker-1",
        target_binding_id: "binding-2",
        replayed: false,
        meaning: "identity_routing_only",
        dataset_eligible: false,
      },
      eligibility_result: "same_speaker_eligible",
      owner_pair: {
        pair_revision_id: "pair-revision-1",
        pair_assignment_id: "pair-assignment-1",
        left_clip: "before",
        right_clip: "after",
      },
    }), { status: 201, headers: { "Content-Type": "application/json" } })));
    const result = await confirmPracticeSelfSpeaker("attempt-1", "practice-speaker-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ownerPair.pairAssignmentId).toBe("pair-assignment-1");
    }
  });
});

describe("general-service private playback boundary", () => {
  it("streams only the three reviewed same-origin playback identities", () => {
    const route = readFileSync(resolve(
      process.cwd(),
      "src/app/api/v2/user/mlc3/[...path]/route.ts",
    ), "utf8");
    expect(route).toContain("exercise-offers/${UUID}/playback");
    expect(route).toContain("practice-attempts/${UUID}/playback");
    expect(route).toContain("guidance/${UUID}/playback");
    expect(route).toContain("const isPlayback = method === \"GET\"");
    expect(route).toContain("const token = await getAccessToken()");
    expect(route).toContain("backendFetch(path, { method: \"GET\", token })");
    expect(route.indexOf("if (isPlayback)"))
      .toBeLessThan(route.indexOf("const idempotency ="));
    expect(route).not.toContain("presigned");
  });
});
