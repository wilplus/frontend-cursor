// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  Exercise routing steps 5–7 (backend 2026-09-28). Pinned here:             */
/*    1. the coach reads the machine's pick in words: fit, how it was chosen, */
/*       what was spotted, and a trial named openly (coach view only);        */
/*    2. no rank or number is rendered, and nothing maps the machine's        */
/*       confidence read even if it arrives;                                  */
/*    3. an untraced pick says the reasons weren't recorded;                  */
/*    4. the speaker's history reads "X came up on earlier Takes too", and    */
/*       done-before exercises are marked;                                    */
/*    5. the gap view shows "Unknown", never 0, for a source it couldn't read;*/
/*    6. "shadow" reads as being tested, and never as detected.               */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MachinePickReasons,
  WhyNothingFitted,
  candidateReason,
  pickSentence,
  titlesFrom,
} from "./MachinePickReasons";
import { mapCandidates, mapMachinePick } from "@/services/api/machinePick";
import { mapCoachConfidencePractice } from "@/services/api/coachConfidencePractice";
import { mapSpeakingError } from "@/services/api/speakingErrors";

const TITLES = titlesFrom([
  { exerciseId: "land-it", title: "Land the ending" },
  { exerciseId: "slow-down", title: "Slow down" },
  { exerciseId: "breathe", title: "One breath" },
]);

const RAW_PICK = {
  exercise_id: "land-it",
  version: 1,
  fit: "exact",
  how_chosen: "best_match",
  traced: true,
  spotted: [{ error_id: "rushing", label: "Rushing" }],
  candidates: [
    { exercise_id: "breathe", outcome: "excluded", reason: "targets_nothing_that_fired", rank: null, fit: null, repeat_hits: 0, done_before: false },
    { exercise_id: "slow-down", outcome: "ranked", reason: "lower_fit_than_pool", rank: 2, fit: "trial", repeat_hits: 1, done_before: true },
    { exercise_id: "land-it", outcome: "ranked", reason: null, rank: 1, fit: "exact", repeat_hits: 0, done_before: false },
  ],
  history: { available: true, repeated_patterns: ["rushing"], done_before: ["slow-down"], earlier_takes: 3 },
  rules_version: "v1",
  confidence_read: 0.82,
};

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
});

function render(node: ReturnType<typeof createElement>) {
  act(() => root.render(node));
}

describe("the machine's pick, for the coach", () => {
  const pick = mapMachinePick(RAW_PICK)!;

  it("reads the pick in words", () => {
    expect(pickSentence(pick, TITLES)).toBe(
      "Machine picked “Land the ending” (exact fit, best match) because it spotted Rushing.",
    );
  });

  it("names a trial and a 'trying another' pick openly", () => {
    const trial = mapMachinePick({ ...RAW_PICK, fit: "trial", how_chosen: "trying_another" })!;
    expect(pickSentence(trial, TITLES)).toContain(
      "trial: it treats this as a secondary problem, trying another: picked on purpose to learn whether it helps",
    );
  });

  it("lists the others in order, with reasons, history, and no numbers", () => {
    render(createElement(MachinePickReasons, { pick, titles: TITLES }));
    const text = container.textContent ?? "";
    expect(text).toContain("Rushing came up on earlier Takes too.");
    expect(text.indexOf("Slow down")).toBeLessThan(text.indexOf("One breath"));
    expect(text).toContain("done before");
    expect(text).toContain("treats a problem that keeps coming back");
    expect(text).toContain("Treats nothing that was spotted here.");
    expect(text).not.toMatch(/\d/);
    expect(text.toLowerCase()).not.toContain("confiden");
  });

  it("never maps the machine's confidence read", () => {
    expect(JSON.stringify(pick)).not.toContain("0.82");
  });

  it("says the reasons weren't recorded for an older pick", () => {
    render(createElement(MachinePickReasons, { pick: mapMachinePick({ ...RAW_PICK, traced: false }), titles: TITLES }));
    expect(container.textContent).toContain("The reasons for this pick weren’t recorded.");
    expect(container.querySelector("details")).toBeNull();
  });

  it("shows nothing when there was no automatic pick", () => {
    render(createElement(MachinePickReasons, { pick: null, titles: TITLES }));
    expect(container.innerHTML).toBe("");
  });

  it("rides on the practice review payload", () => {
    const practice = mapCoachConfidencePractice({
      id: "p1", exact_passage: "x",
      exercise: { exercise_id: "land-it", title: "Land the ending", instruction: "" },
      machine_pick: RAW_PICK,
    });
    expect(practice?.machinePick?.exerciseId).toBe("land-it");
    expect(mapCoachConfidencePractice({
      id: "p1", exact_passage: "x",
      exercise: { exercise_id: "land-it", title: "Land the ending", instruction: "" },
      machine_pick: null,
    })?.machinePick).toBeNull();
  });
});

describe("why nothing fitted, on a coach request", () => {
  it("lists every exercise weighed with its reason", () => {
    render(createElement(WhyNothingFitted, {
      candidates: mapCandidates([{ exercise_id: "breathe", outcome: "excluded", reason: "nothing_spotted" }]),
      titles: TITLES,
    }));
    expect(container.textContent).toContain("One breath");
    expect(container.textContent).toContain("Nothing was spotted on this clip.");
  });

  it("shows nothing when the backend sent no candidates", () => {
    render(createElement(WhyNothingFitted, { candidates: [], titles: TITLES }));
    expect(container.innerHTML).toBe("");
  });

  it("gives a ranked row that isn't the pick a plain reason", () => {
    const [row] = mapCandidates([{ exercise_id: "a", outcome: "ranked", rank: 2 }]);
    expect(candidateReason(row, true)).toBe("Ranked below the pick.");
  });
});
