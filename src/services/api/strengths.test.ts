/*
STORY    As a speaker, I want a Take that can't be deleted because it is part
         of my history to explain why in approved words, so that I understand
         and my history stays whole.
OUTCOME
  O1  A refused Take deletion shows the approved line about the project's
      history.
PROVES   O1 -> "maps a refused take to the approved take line"
WHY      Never-rule 5: every old version stays in the history.
*/
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  deleteRefusalLine,
  deleteTake,
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

  it("maps a refused take to the approved take line", async () => {
    vi.stubGlobal("fetch", refuse(409, { code: "TAKE_HAS_LINEAGE" }));
    const err = await failureOf(deleteTake("pid-1", 2));
    expect(deleteRefusalLine(err, "take")).toBe(
      "This take can't be deleted on its own. It's part of your project's history."
    );
  });
});

// Fixture factories re-exported for downstream tests (type-check only)
export const _fixtures = { mom, sl, take, pres };
