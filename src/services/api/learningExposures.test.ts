import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acknowledgeVisibleLearningExposures,
  newRenderInstanceId,
} from "./learningExposures";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("learning exposure acknowledgement", () => {
  it("sends one post-render ACK per isolated surface with one render identity", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return { ok: true };
    }));
    const renderInstanceId = "33333333-3333-4333-8333-333333333333";

    const saved = await acknowledgeVisibleLearningExposures([
      {
        presentationId: "11111111-1111-4111-8111-111111111111",
        acknowledgementToken: "22222222-2222-4222-8222-222222222222",
        learningSurface: "correction_generation",
      },
      {
        presentationId: "44444444-4444-4444-8444-444444444444",
        acknowledgementToken: "55555555-5555-4555-8555-555555555555",
        learningSurface: "correction_selection",
      },
    ], renderInstanceId);

    expect(saved).toBe(true);
    expect(bodies).toHaveLength(2);
    expect(bodies.map((body) => body.render_instance_id)).toEqual([
      renderInstanceId,
      renderInstanceId,
    ]);
    expect(bodies.every((body) => body.actor_role === "owner")).toBe(true);
    expect(bodies.some((body) => "decision" in body || "value" in body)).toBe(false);
  });

  it("returns false when any surface receipt is not accepted", async () => {
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: call++ === 0 })));
    const saved = await acknowledgeVisibleLearningExposures([
      {
        presentationId: "11111111-1111-4111-8111-111111111111",
        acknowledgementToken: "22222222-2222-4222-8222-222222222222",
        learningSurface: "praise_generation",
      },
      {
        presentationId: "44444444-4444-4444-8444-444444444444",
        acknowledgementToken: "55555555-5555-4555-8555-555555555555",
        learningSurface: "praise_selection",
      },
    ], "33333333-3333-4333-8333-333333333333");
    expect(saved).toBe(false);
  });

  it("creates RFC-4122-shaped render identities", () => {
    expect(newRenderInstanceId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
