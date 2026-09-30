// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  A moment no exercise fitted (backend 2026-09-28) — the coach's panel,     */
/*  the speaker's coach flag, and the CMS main target. Pinned here:           */
/*    1. BLIND COACH: nothing is asked of the server, and nothing renders,    */
/*       until the coach's own Yes/No is saved;                               */
/*    2. 404 (no request), practice off and the blind gate all show nothing;  */
/*    3. the coach answers once; the share is a separate tick that can be     */
/*       added later by resending the same answer;                            */
/*    4. a refusal shows the backend's own sentence;                          */
/*    5. no number reaches the coach or the speaker (AC-9), and "trial" is    */
/*       never read or shown;                                                 */
/*    6. the main target is one of the exercise's own tags, and naming one    */
/*       keeps the rest of the matching criteria.                             */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CoachExerciseRequestPanel, {
  answeredLine,
  requestReasonLine,
  shareAgainAnswer,
} from "./CoachExerciseRequestPanel";
import {
  answerBody,
  mapCoachExerciseRequest,
  type CoachExerciseRequest,
} from "@/services/api/coachExerciseRequest";
import {
  criteriaForMainTarget,
  DEFAULT_MATCHING_CRITERIA,
  keptMainTarget,
} from "@/services/api/journalAdmin";
import { mapDocumentSuggestions } from "@/services/api/idealText";

/** The speaker's offer as the Ideal Text mapper reads it, with `extra` fields
 *  on the backend's practice_exercise. */
function mapIdealTextResponseForTest(extra: Record<string, unknown>) {
  return mapDocumentSuggestions([{
    id: "cv-1", snippet_id: "s1", take_session_id: "t1",
    kind: "bold", source: "confident_voice", feedback_family: "confident_voice",
    quote: "Give every word space.", span: { start: 0, end: 22 },
    evidence: {
      project_id: "p", take_session_id: "t1", slide_index: 1,
      paragraph_index: 0, span: { start: 0, end: 22 },
    },
    practice_exercise: {
      exercise_id: "land-it", version: 1, title: "Land the ending",
      instruction: "Slow down.", introduction: "Try this.",
      explanation_video_ref: "https://cdn.example/land.mp4",
      passage: "Give every word space.", practice_id: null, resume: false,
      ...extra,
    },
  }] as never)?.[0]?.practiceExercise ?? null;
}

const RAW = {
  id: "req-1",
  take_session_id: "t1",
  snippet_id: "s1",
  reason: "nothing_targets_it",
  spotted: [{ error_id: "ending_compression", label: "Swallowed endings" }],
  created_at: "2026-09-28T10:00:00Z",
  resolution: null,
  resolved_exercise_id: null,
  resolved_at: null,
  shared_at: null,
  offered_since: false,
  available_exercises: [
    { exercise_id: "land-it", version: 1, title: "Land the ending", instruction: "Slow the last words.", explanation_video_ref: "https://cdn.example/land.mp4" },
    { exercise_id: "one-breath", version: 2, title: "One breath", instruction: "", explanation_video_ref: null },
  ],
};

function mapped(overrides: Record<string, unknown> = {}): CoachExerciseRequest {
  const value = mapCoachExerciseRequest({ ...RAW, ...overrides });
  if (!value) throw new Error("fixture did not map");
  return value;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

async function renderPanel(enabled: boolean) {
  await act(async () => {
    root.render(createElement(CoachExerciseRequestPanel, {
      sessionId: "sess", snippetId: "s1", enabled,
    }));
  });
}

function button(text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!found) throw new Error(`no button "${text}"`);
  return found as HTMLButtonElement;
}

describe("the blind gate", () => {
  it("asks the server nothing and renders nothing before the coach's answer is saved", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await renderPanel(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe("");
  });

  it.each([
    [404, { code: "NOT_FOUND" }],
    [409, { code: "SPEAKER_PRACTICE_OFF" }],
    [409, { code: "BLIND_RATING_REQUIRED" }],
  ])("shows nothing on %s %j", async (status, body) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(status, body)));
    await renderPanel(true);
    expect(container.innerHTML).toBe("");
  });
});

describe("the panel", () => {
  it("reads the moment in words, best match first, with no numbers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { request: RAW })));
    await renderPanel(true);
    const text = container.textContent ?? "";
    expect(text).toContain("Spotted: Swallowed endings. No exercise in the library treats it yet.");
    expect(text.indexOf("Land the ending")).toBeLessThan(text.indexOf("One breath"));
    expect(text).not.toMatch(/\d/);
    expect(text.toLowerCase()).not.toContain("trial");
  });

  it("saves one answer with the share as its own tick", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? jsonResponse(200, { request: { ...RAW, resolution: "exercise_chosen", resolved_exercise_id: "land-it", shared_at: "2026-09-28T11:00:00Z" } })
        : jsonResponse(200, { request: RAW }));
    vi.stubGlobal("fetch", fetchMock);
    await renderPanel(true);
    const pick = [...container.querySelectorAll("[role=radio]")].find(
      (b) => b.textContent?.includes("Land the ending"),
    ) as HTMLButtonElement;
    await act(async () => { pick.click(); });
    const tick = container.querySelector("input[type=checkbox]") as HTMLInputElement;
    await act(async () => { tick.click(); });
    await act(async () => { button("Save my answer").click(); });
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({
      resolution: "exercise_chosen", exercise_id: "land-it", share_with_user: true,
    });
    expect(container.textContent).toContain("You chose “Land the ending”.");
    expect(container.textContent).toContain("Shared with the speaker.");
    expect(container.textContent).not.toContain("Save my answer");
  });

  it("shows the backend's own refusal sentence", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? jsonResponse(400, { code: "TAG_NOT_DETECTED", error: "these are not errors code can find yet" })
        : jsonResponse(200, { request: RAW })));
    await renderPanel(true);
    await act(async () => { button("No safe match").click(); });
    await act(async () => { button("Save my answer").click(); });
    expect(container.querySelector("[role=alert]")?.textContent).toBe(
      "these are not errors code can find yet",
    );
  });

  it("offers no share tick for no safe match", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { request: RAW })));
    await renderPanel(true);
    await act(async () => { button("No safe match").click(); });
    expect(container.querySelector("input[type=checkbox]")).toBeNull();
  });
});

describe("the request's words", () => {
  it("says nothing was spotted when nothing was", () => {
    expect(requestReasonLine(mapped({ reason: "nothing_spotted", spotted: [] })))
      .toBe("Nothing specific was spotted in this moment.");
  });

  it("reads the answer back by the exercise's title", () => {
    expect(answeredLine(mapped({ resolution: "exercise_authored", resolved_exercise_id: "land-it" })))
      .toBe("You wrote “Land the ending”.");
    expect(answeredLine(mapped({ resolution: "no_safe_match" })))
      .toBe("You said nothing safe fits this moment.");
  });
});

describe("sharing later", () => {
  it("resends the same chosen answer, now shared", () => {
    expect(shareAgainAnswer(mapped({ resolution: "exercise_chosen", resolved_exercise_id: "land-it" })))
      .toEqual({ resolution: "exercise_chosen", exerciseId: "land-it", share: true });
  });

  it("resends an authored one from its library row", () => {
    const again = shareAgainAnswer(mapped({ resolution: "exercise_authored", resolved_exercise_id: "land-it" }));
    expect(again && answerBody(again)).toEqual({
      resolution: "exercise_authored",
      custom_exercise: {
        title: "Land the ending",
        explanation_video_url: "https://cdn.example/land.mp4",
        instruction: "Slow the last words.",
        acoustic_problem_tags: undefined,
      },
      share_with_user: true,
    });
  });

  it.each([
    ["already shared", { resolution: "exercise_chosen", resolved_exercise_id: "land-it", shared_at: "x" }],
    ["nothing to share", { resolution: "no_safe_match" }],
    ["the speaker already got one", { resolution: "exercise_chosen", resolved_exercise_id: "land-it", offered_since: true }],
  ])("offers no share when %s", (_why, overrides) => {
    expect(shareAgainAnswer(mapped(overrides))).toBeNull();
  });
});

describe("the speaker's exercise", () => {
  it("carries the coach's pick as a flag, and no number or trial", () => {
    const offer = mapIdealTextResponseForTest({
      chosen_by_coach: true,
      pattern_distance: 0.42,
      matching_policy_version: "v7",
      trial: true,
    });
    expect(offer?.chosenByCoach).toBe(true);
    const keys = Object.keys(offer ?? {});
    expect(keys).not.toContain("patternDistance");
    expect(keys).not.toContain("matchingPolicyVersion");
    expect(keys.some((key) => key.toLowerCase().includes("trial"))).toBe(false);
  });

  it("reads an absent flag as not chosen by a coach", () => {
    expect(mapIdealTextResponseForTest({})?.chosenByCoach).toBe(false);
  });
});

describe("the main target", () => {
  it("sends nothing when none is named or stored", () => {
    expect(criteriaForMainTarget(null, null)).toBeUndefined();
    expect(criteriaForMainTarget({ max_per_take: 1 }, null)).toBeUndefined();
  });

  it("keeps the backend's defaults on a new exercise", () => {
    expect(criteriaForMainTarget(null, "ending_compression")).toEqual({
      ...DEFAULT_MATCHING_CRITERIA, primary_problem_tag: "ending_compression",
    });
  });

  it("keeps stored criteria, and clears a stored main target", () => {
    const stored = { max_per_take: 1, custom: "kept", primary_problem_tag: "a" };
    expect(criteriaForMainTarget(stored, "b")).toEqual({ ...stored, primary_problem_tag: "b" });
    expect(criteriaForMainTarget(stored, null)).toEqual({ max_per_take: 1, custom: "kept" });
  });

  it("drops a main target that is no longer among the tags", () => {
    expect(keptMainTarget(["a", "b"], "b")).toBe("b");
    expect(keptMainTarget(["a"], "b")).toBeNull();
  });
});
