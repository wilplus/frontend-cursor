import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIdealText } from "./idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Ideal Text visible-exposure handle", () => {
  it("maps the actor-bound production packet on the canonical document", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: "unverified",
        text: "The exact visible document.",
        version: 2,
        learning_exposure: {
          presentation_id: "11111111-1111-4111-8111-111111111111",
          acknowledgement_token: "22222222-2222-4222-8222-222222222222",
          learning_surface: "ideal_text_generation",
          evaluation_only: false,
        },
      }),
    })));

    const result = await fetchIdealText("arc-1");
    expect(result.kind).toBe("single");
    if (result.kind !== "single") throw new Error("expected single document");
    expect(result.learningExposures).toEqual([{
      presentationId: "11111111-1111-4111-8111-111111111111",
      acknowledgementToken: "22222222-2222-4222-8222-222222222222",
      learningSurface: "ideal_text_generation",
    }]);
  });

  it("never maps an evaluation-only packet for rendering", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: "verified",
        text: "Visible text.",
        learning_exposure: {
          presentation_id: "11111111-1111-4111-8111-111111111111",
          acknowledgement_token: "22222222-2222-4222-8222-222222222222",
          learning_surface: "ideal_text_generation",
          evaluation_only: true,
        },
      }),
    })));
    const result = await fetchIdealText("arc-1");
    if (result.kind !== "single") throw new Error("expected single document");
    expect(result.learningExposures).toEqual([]);
  });
});
