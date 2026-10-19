/*
STORY    As a coach, I want saving my judgement to bring back "what happened"
         in that moment when the server sends it, and never on a refused save,
         so that I see the moment's read only after my own answer is in.
OUTCOME
  O1  A 200 carrying moment_read hands the read back mapped.
  O2  A 200 without it leaves it out (the caller reads it the old way).
  O3  A refused save (400) gives only the error, never a read.
PROVES   O1 -> "a saved judgement carries the moment's read back"
         O2 -> "a saved judgement without a read leaves it out"
         O3 -> "a refused save never carries a read"
WHY      C2 (founder 2026-10-08); Never-2: coach judgements stay blind.
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveStateRating } from "./stateRatings";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

const BODY = { state_id: "confidence", value: "yes" as const, idempotency_key: "k-1" };
const MOMENT = {
  passage: "We grew revenue forty percent.", speaker_answer: "no", coach_answer: "yes",
  speaker_goal: "Sound sure.", heard: [{ kind: "error", key: "rushing", label: "Rushing" }],
  request: null, practice: null,
};

function answer(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("saveStateRating carries What happened back (C2)", () => {

  it("a saved judgement carries the moment's read back", async () => {
    answer({ ok: true, moment_read: MOMENT });
    expect(await saveStateRating("s1", BODY)).toEqual({
      ok: true,
      momentRead: {
        passage: "We grew revenue forty percent.",
        speakerAnswer: "no",
        coachAnswer: "yes",
        speakerGoal: "Sound sure.",
        heard: [{ kind: "error", key: "rushing", label: "Rushing" }],
        request: null,
        practice: null,
      },
    });
  });

  it("a saved judgement without a read leaves it out", async () => {
    answer({ ok: true });
    expect(await saveStateRating("s1", BODY)).toEqual({ ok: true });
  });

  it("a refused save never carries a read", async () => {
    answer({ error: "Rate in a language you know.", moment_read: MOMENT }, 400);
    expect(await saveStateRating("s1", BODY)).toEqual({ ok: false, error: "Rate in a language you know." });
  });
});
