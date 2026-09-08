import { afterEach, describe, expect, it, vi } from "vitest";
import { saveTakeFeedbackResponse } from "./takeFeedback";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saveTakeFeedbackResponse", () => {
  it("writes the frozen feedback identity without a caller-controlled clip", async () => {
    let body: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return { ok: true, json: async () => ({ saved: true }) };
    }));
    expect(await saveTakeFeedbackResponse({
      takeSessionId: "take-1",
      feedbackId: "confident-voice:clip-1",
      feedbackFamily: "confident_voice",
      response: "no",
    })).toEqual({ ok: true });
    expect(body).toEqual({
      feedback_id: "confident-voice:clip-1",
      feedback_family: "confident_voice",
      response: "no",
    });
  });

  it("submits the complete opaque canonical identity for an exact candidate", async () => {
    let body: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return { ok: true, json: async () => ({ saved: true }) };
    }));
    await saveTakeFeedbackResponse({
      takeSessionId: "take-1",
      feedbackId: "reused-display-key",
      feedbackFamily: "rewrite_clarity",
      response: "apply_suggestion",
      candidateId: "11111111-1111-4111-8111-111111111111",
      feedbackMembershipId: "22222222-2222-4222-8222-222222222222",
      feedbackExposureId: "33333333-3333-4333-8333-333333333333",
    });
    expect(body).toMatchObject({
      candidate_id: "11111111-1111-4111-8111-111111111111",
      feedback_membership_id: "22222222-2222-4222-8222-222222222222",
      feedback_exposure_id: "33333333-3333-4333-8333-333333333333",
    });
  });
});
