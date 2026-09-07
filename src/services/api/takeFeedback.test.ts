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
