// @vitest-environment jsdom
/*
STORY    As a coach, I want the two V4 sheets to show only the signed words and
         nothing the machine chose, and to save one answer each, so that my
         picks stay blind.
OUTCOME
  O1  Never-2: the moment-pick sheet shows the signed wording and the
      moments' words, and nothing the machine chose (snippet id, slice,
      sureness).
  O2  Picking a moment and saving sends exactly one answer, for that sheet
      and that moment, then says it is kept.
  O3  Never-2: the surer sheet shows the two versions' words and the three
      answers, and nothing of the machine's slice or level, and no player.
  O4  Each surer answer is saved once for its own pair, then the next pair
      shows; after the last, the kept line.
PROVES   O1 -> "draws the signed words and nothing the machine chose"
         O2 -> "saves one pick for the sheet, then says it is kept"
         O3 -> "words only, the question and three answers, blind to the slice"
         O4 -> "saves one answer per pair and moves on"
WHY      Never-2 (BLIND COACH), founder S-B8 A.
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const answerV4MomentPick = vi.fn(async () => ({ ok: true as const }));
const answerV4Surer = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/services/api/coachPanel", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachPanel")>()),
  answerV4MomentPick: (...a: unknown[]) => answerV4MomentPick(...(a as [])),
  answerV4Surer: (...a: unknown[]) => answerV4Surer(...(a as [])),
}));
vi.mock("../SnippetWavePlayer", () => ({ default: () => <div data-player /> }));

import { V4MomentPickSheet, V4SurerSheet } from "./V4BlindSheets";
import { mapV4MomentPickQueue, mapV4SurerQueue } from "@/services/api/coachPanel";

const PICK_WORDING = {
  queue_line: "Also waiting · blind", row: "Pick the moment for feedback",
  title: "Pick the moment for feedback", caption: "Words and audio. No names, no hint of the machine's pick.",
  question: "Which moment most needs feedback?", moment: "Moment {letter}", this_one: "This one",
  needs_it_most: "Needs it most", save: "Save my pick", none: "None needs it",
  progress: "Block {n} of {of}", kept: "Thank you. That one is kept.",
};
const SURER_WORDING = {
  queue_line: "Also waiting · blind", row: "Which sounds surer", title: "Which sounds surer",
  caption: "Words only. No names, no hint of which change the machine is testing.",
  said: "The words said", new: "The new version", question: "Is the new version surer?",
  yes: "Yes", no: "No", cant_tell: "Can't tell", progress: "Pair {n} of {of}",
  kept: "Thank you. That one is kept.",
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  answerV4MomentPick.mockClear();
  answerV4Surer.mockClear();
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("Pick the moment for feedback", () => {
  const queue = mapV4MomentPickQueue({
    wording: PICK_WORDING,
    items: [{ sheet_id: "s1", n: 1, of: 1, v4_snippet_id: "LEAK", slice: "unsure", sureness: 0.1,
      moments: [
        { clip_id: "c1", letter: "A", words: "So what we found", audio_ref: "blob:a", start_offset_ms: 0, duration_ms: 4000 },
        { clip_id: "c2", letter: "B", words: "Our second quarter", audio_ref: "blob:a", start_offset_ms: 4000, duration_ms: 4000 },
      ] }],
  });

  it("draws the signed words and nothing the machine chose", () => {
    act(() => root.render(<V4MomentPickSheet queue={queue} nextLabel="Next" onClose={() => {}} onDone={() => {}} />));
    const text = host.textContent ?? "";
    for (const word of ["Block 1 of 1", "Pick the moment for feedback", "Which moment most needs feedback?",
      "Moment A", "Moment B", "So what we found", "Save my pick", "None needs it"]) {
      expect(text).toContain(word);
    }
    for (const leak of ["LEAK", "unsure", "0.1", "sureness"]) expect(host.innerHTML).not.toContain(leak);
  });

  it("saves one pick for the sheet, then says it is kept", async () => {
    act(() => root.render(<V4MomentPickSheet queue={queue} nextLabel="Next" onClose={() => {}} onDone={() => {}} />));
    const choices = host.querySelectorAll<HTMLButtonElement>("[data-testid='v4-moment-pick-choice']");
    await act(async () => choices[1].click());
    await act(async () => host.querySelector<HTMLButtonElement>("[data-testid='v4-moment-pick-save']")!.click());
    expect(answerV4MomentPick).toHaveBeenCalledTimes(1);
    expect(answerV4MomentPick).toHaveBeenCalledWith("s1", { clipId: "c2" });
    expect(host.textContent).toContain("Thank you. That one is kept.");
  });
});

describe("Which sounds surer", () => {
  const queue = mapV4SurerQueue({
    wording: SURER_WORDING,
    items: [{ sheet_id: "p1", n: 1, of: 2, said: "I think maybe we start.", new: "We start.", slice: "above", level: 0.7 },
            { sheet_id: "p2", n: 2, of: 2, said: "Um we grew.", new: "We grew." }],
  });

  it("words only, the question and three answers, blind to the slice", () => {
    act(() => root.render(<V4SurerSheet queue={queue} nextLabel="Next" onClose={() => {}} onDone={() => {}} />));
    const text = host.textContent ?? "";
    for (const word of ["Pair 1 of 2", "The words said", "The new version", "I think maybe we start.",
      "We start.", "Is the new version surer?", "Yes", "No", "Can't tell"]) expect(text).toContain(word);
    for (const leak of ["above", "0.7", "level"]) expect(host.innerHTML).not.toContain(leak);
    expect(host.querySelector("[data-player]")).toBeNull();
  });

  it("saves one answer per pair and moves on", async () => {
    act(() => root.render(<V4SurerSheet queue={queue} nextLabel="Next" onClose={() => {}} onDone={() => {}} />));
    const tap = (value: string) =>
      act(async () => host.querySelector<HTMLButtonElement>(`[data-v4-surer-answer='${value}']`)!.click());
    await tap("no");
    expect(answerV4Surer).toHaveBeenCalledTimes(1);
    expect(answerV4Surer).toHaveBeenLastCalledWith("p1", "no");
    expect(host.textContent).toContain("Pair 2 of 2");
    expect(host.textContent).toContain("Um we grew.");
    await tap("yes");
    expect(answerV4Surer).toHaveBeenCalledTimes(2);
    expect(answerV4Surer).toHaveBeenLastCalledWith("p2", "yes");
    expect(host.textContent).toContain("Thank you. That one is kept.");
  });
});
