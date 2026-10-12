// @vitest-environment jsdom
/* V4's two blind sheets (founder S-B8 A): drawn from the signed wording,
   nothing the machine chose in the DOM (BLIND COACH, AC-9), one answer each. */
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
});
