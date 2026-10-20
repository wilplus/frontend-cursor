/*
STORY    As a speaker, I want my answer about a feedback item saved against
         the exact feedback I saw, and a changed answer accepted with its
         follow-up, so that my judgements are recorded correctly.
OUTCOME
  O1  My answer is saved against that feedback item only, with no recording
      details added by the app.
  O2  A changed answer is accepted as a save, with what to show next.
PROVES   O1 -> "writes the frozen feedback identity without a caller-controlled clip"
         O2 -> "reads the 200 revised body as a save, with its follow-up"
*/
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
});
