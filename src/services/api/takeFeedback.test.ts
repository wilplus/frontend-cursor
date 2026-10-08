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

describe("the superseded-Take refusal (backend #597)", () => {
  const refuse = (status: number, error: string) =>
    vi.fn(async () => ({
      ok: false, status, json: async () => ({ code: "INVALID_INPUT", error }),
    }));

  it("names the not_member refusal so the sheet can stop retrying it", async () => {
    // The exact line from routes/v2/user_sessions.py — the only discriminator
    // there is, since it shares INVALID_INPUT with every other bad body.
    vi.stubGlobal("fetch", refuse(400, "feedback item is not in this Take's frozen set"));
    expect(await saveTakeFeedbackResponse({
      takeSessionId: "take-1",
      feedbackId: "s-cv",
      feedbackFamily: "confident_voice",
      response: "yes",
    })).toEqual({
      ok: false,
      error: "feedback item is not in this Take's frozen set",
      reason: "superseded",
    });
  });

  it("leaves every other 400 as an ordinary failure", async () => {
    vi.stubGlobal("fetch", refuse(400, "snippet provenance does not match the feedback item"));
    const result = await saveTakeFeedbackResponse({
      takeSessionId: "take-1",
      feedbackId: "s-cv",
      feedbackFamily: "confident_voice",
      response: "yes",
    });
    expect(result.ok).toBe(false);
    expect("reason" in result).toBe(false);
  });
});

describe("an accepted rewrite's text update (Phase 4, P1-1)", () => {
  it("carries the server's text_update", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ saved: true, text_update: "protected" }),
    })));
    expect(await saveTakeFeedbackResponse({
      takeSessionId: "take-1", feedbackId: "rw-1",
      feedbackFamily: "rewrite_clarity", response: "apply_suggestion",
    })).toEqual({ ok: true, textUpdate: "protected" });
  });

  it("reads the outcome", async () => {
    const { acceptOutcome } = await import("./takeFeedback");
    expect(acceptOutcome("applied")).toBe("server");
    expect(acceptOutcome("already_applied")).toBe("server");
    expect(acceptOutcome(undefined)).toBe("legacy");
    expect(acceptOutcome("not_found")).toBe("legacy");
    for (const refused of ["protected", "stale", "failed", "anything"]) {
      expect(acceptOutcome(refused)).toBe("refused");
    }
  });
});

describe("a changed judgement (QA1 A, D-FW-9)", () => {
  it("reads the 200 revised body as a save, with its follow-up", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        saved: true, revised: true, feedback_id: "cv-1",
        feedback_family: "confident_voice", response: "no", follow_up: "library_video",
      }),
    })));
    expect(await saveTakeFeedbackResponse({
      takeSessionId: "take-1", feedbackId: "cv-1",
      feedbackFamily: "confident_voice", response: "no",
    })).toEqual({ ok: true, revised: true, followUp: "library_video" });
  });

  it("an ordinary first save carries its follow-up and no revised flag", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ saved: true, response: "yes", follow_up: "none" }),
    })));
    expect(await saveTakeFeedbackResponse({
      takeSessionId: "take-1", feedbackId: "cv-1",
      feedbackFamily: "confident_voice", response: "yes",
    })).toEqual({ ok: true, followUp: "none" });
  });

  it("a rewrite's answer is still final: the 409 is a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 409,
      json: async () => ({ code: "RESPONSE_ALREADY_FINAL", error: "This response is already final." }),
    })));
    expect(await saveTakeFeedbackResponse({
      takeSessionId: "take-1", feedbackId: "rw-1",
      feedbackFamily: "rewrite_clarity", response: "keep_wording",
    })).toEqual({ ok: false, error: "This response is already final." });
  });

  it("a revision that could not be saved (500) is a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 500,
      json: async () => ({ code: "V2_ERROR", error: "Could not save this response." }),
    })));
    const result = await saveTakeFeedbackResponse({
      takeSessionId: "take-1", feedbackId: "cv-1",
      feedbackFamily: "confident_voice", response: "in_between",
    });
    expect(result.ok).toBe(false);
  });
});
