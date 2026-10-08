/* C2 (founder 2026-10-08): the label PUT may answer with the moment's read,
   exactly GET …/moment's body; saveStateRating hands it back mapped, and
   leaves it out when the backend does not send it. */
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
  it("maps moment_read when the PUT sends it", async () => {
    answer({ ok: true, moment_read: MOMENT });
    expect(await saveStateRating("s1", BODY)).toEqual({
      ok: true,
      momentRead: {
        passage: MOMENT.passage, speakerAnswer: "no", coachAnswer: "yes", speakerGoal: "Sound sure.",
        heard: [{ kind: "error", key: "rushing", label: "Rushing" }], request: null, practice: null,
      },
    });
  });

  it("no moment_read (an older backend), or a null one: no momentRead, the caller falls back", async () => {
    answer({ ok: true });
    expect(await saveStateRating("s1", BODY)).toEqual({ ok: true });
    answer({ ok: true, moment_read: null });
    expect(await saveStateRating("s1", BODY)).toEqual({ ok: true });
  });

  it("a refused save never carries a read", async () => {
    answer({ error: "Rate in a language you know.", moment_read: MOMENT }, 400);
    expect(await saveStateRating("s1", BODY)).toEqual({ ok: false, error: "Rate in a language you know." });
  });
});
