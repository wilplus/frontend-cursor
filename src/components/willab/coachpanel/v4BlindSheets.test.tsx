// @vitest-environment jsdom
/*
STORY    As a coach, I want the V4 pick sheet to show only the signed words and
         nothing the machine chose, and to save one answer each, so that my
         picks stay blind.
OUTCOME
  O1  Never-2: the moment-pick sheet shows the signed wording and the
      moments' words, and nothing the machine chose (snippet id, slice,
      sureness).
  O2  Picking a moment and saving sends exactly one answer, for that sheet
      and that moment, then says it is kept.
PROVES   O1 -> "draws the signed words and nothing the machine chose"
         O2 -> "saves one pick for the sheet, then says it is kept"
WHY      Never-2 (BLIND COACH), founder S-B8 A.
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const answerV4MomentPick = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/services/api/coachPanel", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachPanel")>()),
  answerV4MomentPick: (...a: unknown[]) => answerV4MomentPick(...(a as [])),
}));
vi.mock("../SnippetWavePlayer", () => ({ default: () => <div data-player /> }));

import { V4MomentPickSheet } from "./V4BlindSheets";
import { mapV4MomentPickQueue } from "@/services/api/coachPanel";

const PICK_WORDING = {
  queue_line: "Also waiting · blind", row: "Pick the moment for feedback",
  title: "Pick the moment for feedback", caption: "Words and audio. No names, no hint of the machine's pick.",
  question: "Which moment most needs feedback?", moment: "Moment {letter}", this_one: "This one",
  needs_it_most: "Needs it most", save: "Save my pick", none: "None needs it",
  progress: "Block {n} of {of}", kept: "Thank you. That one is kept.",
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  answerV4MomentPick.mockClear();
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
