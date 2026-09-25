import { describe, expect, it, vi, afterEach } from "vitest";
import {
  mapStrengths,
  deletePresentation,
  deleteRefusalLine,
  deleteTake,
  DeleteFailedError,
  TAKE_LINEAGE_REFUSAL,
  type StrengthMoment,
  type StrengthSlide,
  type PresentationTake,
  type PresentationGroup,
} from "./strengths";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn().mockResolvedValue("test-token"),
}));

const mom = (over: Partial<StrengthMoment> = {}): StrengthMoment => ({
  transcript: "t",
  note: "n",
  audioRef: null,
  startOffsetMs: 0,
  durationMs: 0,
  rank: 1,
  features: null,
  ...over,
});
const sl = (index: number, moments: StrengthMoment[]): StrengthSlide => ({
  index,
  title: `S${index}`,
  body: "",
  moments,
  transcript: "",
  audioRef: null,
  startOffsetMs: 0,
  durationMs: 0,
});
const take = (over: Partial<PresentationTake> = {}): PresentationTake => ({
  takeNumber: 1,
  sessionId: "s",
  createdAt: "2026-01-01",
  presentationRef: "u",
  slides: [],
  ...over,
});
const pres = (over: Partial<PresentationGroup> = {}): PresentationGroup => ({
  presentationId: "pid",
  presentationRef: "u",
  topic: "My app",
  slides: [],
  bestLines: [],
  takes: [take()],
  arcId: null,
  ...over,
});

describe("mapStrengths", () => {
  it("maps general + presentations (snake to camel) and keeps empty slides", () => {
    const v = mapStrengths({
      general: [
        {
          transcript: "hi",
          note: "good values",
          audio_ref: "a",
          start_offset_ms: 100,
          duration_ms: 2000,
        },
        { transcript: "", note: "", audio_ref: null }, // nothing renderable → dropped
      ],
      presentations: [
        {
          presentation_id: "pid1",
          presentation_ref: "u",
          arc_id: "arc-1",
          topic: "Pitch",
          slides: [
            {
              index: 0,
              title: "Cover",
              body: "",
              strong_snippets: [
                {
                  transcript: "open",
                  note: "n",
                  audio_ref: "a",
                  start_offset_ms: 0,
                  duration_ms: 1000,
                  rank: 1,
                },
              ],
            },
            { index: 1, title: "Body", body: "x", strong_snippets: [] }, // kept
          ],
          best_lines: [
            {
              slide_index: 0,
              title: "Cover",
              body: "",
              moment: {
                transcript: "open",
                note: "n",
                audio_ref: "a",
                start_offset_ms: 0,
                duration_ms: 1000,
                rank: 1,
              },
            },
          ],
          takes: [
            {
              take_number: 1,
              session_id: "s1",
              created_at: "2026-02-01",
              presentation_ref: "u",
              slides: [
                {
                  index: 0,
                  title: "Cover",
                  body: "",
                  strong_snippets: [
                    {
                      transcript: "open",
                      note: "n",
                      audio_ref: "a",
                      start_offset_ms: 0,
                      duration_ms: 1000,
                      rank: 1,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(v.general).toHaveLength(1);
    expect(v.general[0]).toEqual({
      transcript: "hi",
      note: "good values",
      audioRef: "a",
      startOffsetMs: 100,
      durationMs: 2000,
      rank: null,
      features: null,
    });

    expect(v.presentations).toHaveLength(1);
    const p = v.presentations[0];
    expect(p.presentationId).toBe("pid1");
    expect(p.topic).toBe("Pitch");
    expect(p.presentationRef).toBe("u");
    expect(p.slides).toHaveLength(2);
    expect(p.slides[0].moments[0].rank).toBe(1);
    expect(p.slides[1].moments).toEqual([]); // empty slide preserved

    expect(p.bestLines).toHaveLength(1);
    expect(p.bestLines[0].index).toBe(0);
    expect(p.bestLines[0].moment.transcript).toBe("open");

    expect(p.takes).toHaveLength(1);
    expect(p.takes[0].takeNumber).toBe(1);
    expect(p.takes[0].sessionId).toBe("s1");
    expect(p.takes[0].slides).toHaveLength(1);

    // arc_id → arcId: opens the composed best-presentation from Trainings.
    expect(p.arcId).toBe("arc-1");
  });

  it("arcId is null when the presentation has no arc_id", () => {
    const v = mapStrengths({
      presentations: [{ presentation_id: "p", topic: "t", takes: [] }],
    });
    expect(v.presentations[0].arcId).toBeNull();
  });

  it("defaults to an empty view on a bad / blank body", () => {
    expect(mapStrengths(null)).toEqual({ general: [], presentations: [] });
    expect(mapStrengths({})).toEqual({ general: [], presentations: [] });
  });

  it("drops a presentation with no presentation_id", () => {
    expect(
      mapStrengths({ presentations: [{ topic: "x", takes: [] }] }).presentations
    ).toEqual([]);
  });

  it("drops a take with no take_number", () => {
    const v = mapStrengths({
      presentations: [
        {
          presentation_id: "pid",
          presentation_ref: "u",
          topic: "T",
          slides: [],
          best_lines: [],
          takes: [{ session_id: "s1", created_at: "2026-01-01" }], // no take_number
        },
      ],
    });
    expect(v.presentations[0].takes).toEqual([]);
  });

  it("drops a best_line with no slide_index", () => {
    const v = mapStrengths({
      presentations: [
        {
          presentation_id: "pid",
          presentation_ref: "u",
          topic: "T",
          slides: [],
          best_lines: [{ title: "x", body: "" }], // no slide_index
          takes: [],
        },
      ],
    });
    expect(v.presentations[0].bestLines).toEqual([]);
  });

  it("C / BE #6 — maps the per-take, per-slide verbatim transcript + slide audio", () => {
    const v = mapStrengths({
      presentations: [
        {
          presentation_id: "pid",
          presentation_ref: "u",
          topic: "T",
          slides: [],
          best_lines: [],
          takes: [
            {
              take_number: 1,
              session_id: "s1",
              created_at: "2026-04-01",
              presentation_ref: "u",
              slides: [
                {
                  index: 0,
                  title: "Cover",
                  body: "",
                  transcript: "the full verbatim words I said on this slide",
                  audio_ref: "take-audio",
                  start_offset_ms: 1500,
                  duration_ms: 8000,
                  strong_snippets: [],
                },
              ],
            },
          ],
        },
      ],
    });
    const slide = v.presentations[0].takes[0].slides[0];
    expect(slide.transcript).toBe("the full verbatim words I said on this slide");
    expect(slide.audioRef).toBe("take-audio");
    expect(slide.startOffsetMs).toBe(1500);
    expect(slide.durationMs).toBe(8000);
    // No standout snippet, but the verbatim transcript is still there → the
    // take viewer no longer shows "No standout moment on this slide yet."
    expect(slide.moments).toEqual([]);
  });

  it("slide transcript/audio default to ''/null when the BE omits them", () => {
    const v = mapStrengths({
      presentations: [
        {
          presentation_id: "pid",
          presentation_ref: "u",
          topic: "T",
          slides: [{ index: 0, title: "Cover", body: "", strong_snippets: [] }],
          best_lines: [],
          takes: [],
        },
      ],
    });
    const slide = v.presentations[0].slides[0];
    expect(slide.transcript).toBe("");
    expect(slide.audioRef).toBeNull();
    expect(slide.startOffsetMs).toBe(0);
    expect(slide.durationMs).toBe(0);
  });

  it("maps a take with null presentation_ref", () => {
    const v = mapStrengths({
      presentations: [
        {
          presentation_id: "pid",
          presentation_ref: "u",
          topic: "T",
          slides: [],
          best_lines: [],
          takes: [
            {
              take_number: 2,
              session_id: "s2",
              created_at: "2026-03-01",
              presentation_ref: null,
              slides: [],
            },
          ],
        },
      ],
    });
    expect(v.presentations[0].takes[0].presentationRef).toBeNull();
    expect(v.presentations[0].takes[0].takeNumber).toBe(2);
  });
});

describe("mapPresentation", () => {
  it("preserves all fields from a well-formed raw presentation", () => {
    const v = mapStrengths({
      presentations: [
        {
          presentation_id: "abc123",
          presentation_ref: "https://example.com/deck.pdf",
          topic: "Product demo",
          slides: [{ index: 0, title: "Title", body: "Content", strong_snippets: [] }],
          best_lines: [],
          takes: [
            {
              take_number: 1,
              session_id: "sess-1",
              created_at: "2026-01-15",
              presentation_ref: "https://example.com/deck.pdf",
              slides: [],
            },
          ],
        },
      ],
    });
    const p = v.presentations[0];
    expect(p.presentationId).toBe("abc123");
    expect(p.presentationRef).toBe("https://example.com/deck.pdf");
    expect(p.topic).toBe("Product demo");
    expect(p.slides).toHaveLength(1);
    expect(p.takes).toHaveLength(1);
    expect(p.takes[0].sessionId).toBe("sess-1");
  });
});

describe("deletePresentation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls DELETE on the correct URL and resolves on 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    await expect(deletePresentation("pid-123")).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v2/user/presentations/pid-123",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws on non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", mockFetch);

    await expect(deletePresentation("pid-404")).rejects.toThrow("404");
  });
});

describe("deleteTake", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls DELETE on the correct URL and resolves on 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    await expect(deleteTake("pid-123", 2)).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v2/user/presentations/pid-123/takes/2",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws on non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", mockFetch);

    await expect(deleteTake("pid-123", 1)).rejects.toThrow("500");
  });
});

describe("a delete the backend refuses (409 TAKE_HAS_LINEAGE)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const refuse = (status: number, body: unknown) =>
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve(body),
    });

  async function failureOf(p: Promise<unknown>): Promise<unknown> {
    try {
      await p;
    } catch (e) {
      return e;
    }
    throw new Error("expected the delete to throw");
  }

  it("carries the status and code the backend sent", async () => {
    vi.stubGlobal("fetch", refuse(409, { code: "TAKE_HAS_LINEAGE", error: "x" }));
    const err = await failureOf(deleteTake("pid-1", 2));
    expect(err).toBeInstanceOf(DeleteFailedError);
    expect((err as DeleteFailedError).status).toBe(409);
    expect((err as DeleteFailedError).code).toBe("TAKE_HAS_LINEAGE");
    expect((err as Error).message).toContain("409");
  });

  it("maps a refused take to the approved take line", async () => {
    vi.stubGlobal("fetch", refuse(409, { code: "TAKE_HAS_LINEAGE" }));
    const err = await failureOf(deleteTake("pid-1", 2));
    expect(deleteRefusalLine(err, "take")).toBe(
      "This take can't be deleted on its own. It's part of your project's history."
    );
  });

  it("maps a refused presentation to the approved presentation line", async () => {
    vi.stubGlobal("fetch", refuse(409, { code: "TAKE_HAS_LINEAGE" }));
    const err = await failureOf(deletePresentation("pid-1"));
    expect(deleteRefusalLine(err, "presentation")).toBe(
      "This presentation can't be deleted on its own. Its takes are part of your project's history."
    );
  });

  it("keeps the approved lines word for word", () => {
    expect(TAKE_LINEAGE_REFUSAL).toEqual({
      take: "This take can't be deleted on its own. It's part of your project's history.",
      presentation:
        "This presentation can't be deleted on its own. Its takes are part of your project's history.",
    });
  });

  it("leaves every other failure to the existing copy", async () => {
    const cases: Array<[number, unknown]> = [
      [409, { code: "SOMETHING_ELSE" }], // a 409 with another code
      [500, { code: "TAKE_HAS_LINEAGE" }], // the code without the 409
      [404, { code: "NOT_FOUND" }],
      [502, "not an object"],
    ];
    for (const [status, body] of cases) {
      vi.stubGlobal("fetch", refuse(status, body));
      const err = await failureOf(deleteTake("pid-1", 1));
      expect(deleteRefusalLine(err, "take")).toBeNull();
      expect(deleteRefusalLine(err, "presentation")).toBeNull();
    }
  });

  it("survives a body that is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.reject(new SyntaxError("Unexpected token <")),
      })
    );
    const err = await failureOf(deletePresentation("pid-1"));
    expect((err as DeleteFailedError).code).toBeNull();
    expect(deleteRefusalLine(err, "presentation")).toBeNull();
  });

  it("ignores errors that did not come from a delete", () => {
    expect(deleteRefusalLine(new Error("409 TAKE_HAS_LINEAGE"), "take")).toBeNull();
    expect(deleteRefusalLine(undefined, "take")).toBeNull();
  });
});

// Fixture factories re-exported for downstream tests (type-check only)
export const _fixtures = { mom, sl, take, pres };
