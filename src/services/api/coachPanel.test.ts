import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  answerBlockPick,
  answerErrorAudit,
  draftTakeWord,
  fetchExercisePreference,
  mapBlockPickQueue,
  mapCoachWordDraft,
  mapErrorAuditQueue,
  mapExercisePreferenceView,
  recordExercisePreference,
} from "./coachPanel";

/* -------------------------------------------------------------------------- */
/*  THE COACH PANEL'S LEARNING ADDITIONS — the clients (founder 2026-10-01).  */
/*  Pins: the maps read the backend's names and nothing else (no rank, no   */
/*  score, no machine pick ever reaches a sheet); a dark route (404) reads   */
/*  as null; the bodies carry the backend's field names; every BFF route    */
/*  goes through the one relay idiom.                                       */
/* -------------------------------------------------------------------------- */

describe("the maps", () => {
  it("read the served exercise and the shuffled pool, nothing ranked", () => {
    const out = mapExercisePreferenceView({
      served: { exercise_id: "ex-a", version: 2, title: "Land it", instruction: "do it",
        treats: [{ error_id: "rushing", label: "Rushing" }] },
      draw: "exploration", fit: "exact", fired: ["rushing"],
      pool: [{ exercise_id: "ex-b", served: false, title: "B", instruction: "b", rank: 1, score: 0.9 },
             { exercise_id: "ex-a", served: true, title: "Land it", instruction: "do it" }],
    });
    expect(out?.served).toEqual({ exerciseId: "ex-a", title: "Land it", instruction: "do it", treats: ["Rushing"] });
    expect(out?.pool.map((p) => Object.keys(p).sort())).toEqual([
      ["exerciseId", "instruction", "served", "title"], ["exerciseId", "instruction", "served", "title"],
    ]);
    expect(mapExercisePreferenceView({ pool: [] })).toBeNull();
  });

  it("read a draft with its label, and refuse an unknown surface", () => {
    expect(mapCoachWordDraft({ draft: { surface: "coach_take_word", text: "One word.", model_version: "m",
      label: "Drafted from this Take · edit every word" } }))
      .toEqual({ surface: "coach_take_word", text: "One word.", modelVersion: "m",
        label: "Drafted from this Take · edit every word" });
    expect(mapCoachWordDraft({ draft: { surface: "praise_line", text: "x" } })).toBeNull();
  });

  it("read the audit queue as a clip and the error's own question", () => {
    const out = mapErrorAuditQueue({
      items: [{ audit_id: "a1", clip_id: "c1", audio_ref: "https://a", error_id: "rushing",
        label: "Rushing", asks: "Do you hear rushing here?", fired_at_sampling: true }],
      wording: { title: "Do you hear it?", yes: "Yes", nested: { x: 1 } },
    });
    expect(out.items[0]).toEqual({ auditId: "a1", clipId: "c1", audioRef: "https://a", errorId: "rushing",
      label: "Rushing", asks: "Do you hear rushing here?" });
    expect(out.wording).toEqual({ title: "Do you hear it?", yes: "Yes" });
  });

  it("read a block pick as letters and sounds", () => {
    const out = mapBlockPickQueue({ items: [{ pick_id: "p1", n: 1, of: 2, manager_pick: "leak",
      clips: [{ clip_id: "s1", letter: "A", audio_ref: "https://1" }, { clip_id: "s2", letter: "B", audio_ref: null }] }] });
    expect(out.items[0]).toEqual({ pickId: "p1", n: 1, of: 2,
      clips: [{ clipId: "s1", letter: "A", audioRef: "https://1" }, { clipId: "s2", letter: "B", audioRef: null }] });
  });
});

describe("the calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a dark route reads as null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ code: "NOT_FOUND" }) }));
    expect(await fetchExercisePreference("s", "m")).toBeNull();
    expect(await draftTakeWord("s")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchExercisePreference("s", "m")).toBeNull();
  });

  it("carry the backend's field names", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ preference: { id: "p" } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ recorded: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ recorded: true }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await recordExercisePreference("s", "m", { action: "swapped", chosenExerciseId: "ex-b" })).toEqual({ ok: true });
    expect(await answerErrorAudit("a1", "cant_tell")).toEqual({ ok: true });
    expect(await answerBlockPick("p1", { cantTell: true })).toEqual({ ok: true });
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(bodies).toEqual([{ action: "swapped", chosen_exercise_id: "ex-b" }, { answer: "cant_tell" }, { cant_tell: true }]);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v2/coach/sessions/s/snippets/m/exercise-preference");
  });

  it("every BFF route goes through the one relay", () => {
    const routes = [
      "src/app/api/v2/coach/sessions/[sessionId]/snippets/[snippetId]/exercise-preference/route.ts",
      "src/app/api/v2/coach/sessions/[sessionId]/snippets/[snippetId]/moment-line/draft/route.ts",
      "src/app/api/v2/coach/sessions/[sessionId]/word/draft/route.ts",
      "src/app/api/v2/coach/error-audit/route.ts",
      "src/app/api/v2/coach/error-audit/[auditId]/answer/route.ts",
      "src/app/api/v2/coach/block-picks/route.ts",
      "src/app/api/v2/coach/block-picks/[pickId]/answer/route.ts",
    ];
    for (const route of routes) {
      const source = readFileSync(route, "utf8");
      expect(source).toMatch(/relayJson\(/);
      expect(source).not.toMatch(/\bfetch\(/);
    }
  });
});
