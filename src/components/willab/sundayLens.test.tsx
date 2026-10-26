// @vitest-environment jsdom
/*
STORY    As the founder, I want to investigate the pattern Will spotted in my # notes one step at a time, so that I name the bug, the principle I had and my own reflection, and keep a new principle only if I say so.
OUTCOME
  O1  Investigate opens the lens on the case; the bug, the principle held, my reflection and Will's new principle come one at a time, each answer goes to the backend as that step, and the lens ends with Close.
  O2  Opened again, the lens replays the rows so far and asks only the step it waits on.
  O3  In the Lounge, the "We spotted a pattern!" bubble waits (orange outline) until Will's last line is in the thread, and Not now | Investigate is about the newest case.
PROVES   O1 -> walks me through the case one step at a time
         O2 -> reopens where it stands
         O3 -> knows which case waits
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getSundayNote: vi.fn(), answerSundayNote: vi.fn() }));
vi.mock("@/services/api/voiceNotebook", () => api);

import SundayLens from "./SundayLens";
import { sundayAskOf, sundayWaiting } from "@/lib/willab/sundayNote";

const CASE = "Twice this week you put off calling the client because you did not feel like it.";
const LIKELY = [{ id: "h2", title: "Ask, do not assume" }, { id: "h1", title: "Reach out first" }];
type Row = { role: "user" | "bot"; body: string; step: string };
const note = (step: string, rows: Row[]) => ({ id: "s1", case: CASE, likely: LIKELY, new_principle: "Make the call before you feel ready.", step, rows });

const R = {
  open: { role: "bot", body: "What one of those was it?", step: "open" },
  bug: [{ role: "user", body: "👾 Hubris", step: "bug" }, { role: "bot", body: "Did you have a principle in place already?", step: "bug" }],
  applied: [{ role: "user", body: "⚜️ Ask, do not assume", step: "applied" }, { role: "bot", body: "Reflections: what do you take from this?", step: "applied" }],
  reflection: [
    { role: "user", body: "Skip", step: "reflection" },
    { role: "bot", body: "Will suggests a new principle:", step: "reflection" },
    { role: "bot", body: "⚜️ Make the call before you feel ready.", step: "suggested" },
  ],
  principle: [{ role: "user", body: "Accept", step: "principle" }, { role: "bot", body: "Noted. Added to your principles.", step: "principle" }],
} as const;

let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const text = () => document.body.textContent ?? "";

async function settle() {
  for (let i = 0; i < 14; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
  }
}

async function tap(label: string) {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
  if (!button) throw new Error(`no button "${label}" in: ${text()}`);
  await act(async () => button.click());
  await settle();
}

async function open() {
  await act(async () => root.render(createElement(SundayLens, { noteId: "s1", nonce: 1, onClose })));
  await settle();
}

describe("the Sunday note lens", () => {
  it("walks me through the case one step at a time", async () => {
    const rows: Row[] = [];
    api.getSundayNote.mockResolvedValue(note("bug", []));
    api.answerSundayNote.mockImplementation(async (_id: string, step: string) => {
      if (step === "open") rows.push(R.open);
      else rows.push(...R[step as "bug" | "applied" | "reflection" | "principle"]);
      const next = { open: "bug", bug: "applied", applied: "reflection", reflection: "principle", principle: "done" }[step];
      return note(next ?? "done", [...rows]);
    });
    await open();
    expect(text()).toContain("Sunday note");
    expect(text()).toContain("We spotted a pattern!");
    expect(text()).toContain(CASE);
    expect(text()).toContain("What one of those was it?");
    await tap("Hubris");
    expect(api.answerSundayNote).toHaveBeenCalledWith("s1", "bug", "hubris");
    expect(text()).toContain("Did you have a principle in place already?");
    expect(text()).toContain("None yet");
    await tap("Ask, do not assume");
    expect(api.answerSundayNote).toHaveBeenCalledWith("s1", "applied", "h2");
    await tap("Skip");
    expect(api.answerSundayNote).toHaveBeenCalledWith("s1", "reflection", "");
    expect(text()).toContain("⚜️ Make the call before you feel ready.");
    await tap("Accept");
    expect(api.answerSundayNote).toHaveBeenCalledWith("s1", "principle", "accept");
    expect(text()).toContain("Noted. Added to your principles.");
    await tap("Close");
    expect(onClose).toHaveBeenCalled();
  });

  it("reopens where it stands", async () => {
    api.getSundayNote.mockResolvedValue(note("reflection", [R.open, ...R.bug, ...R.applied]));
    await open();
    expect(text()).toContain("👾 Hubris");
    expect(text()).toContain("Reflections: what do you take from this?");
    expect(api.answerSundayNote).not.toHaveBeenCalledWith("s1", "open");
    expect(document.querySelector("textarea")).not.toBeNull();
    expect(text()).not.toContain("Wishful thinking");
  });

  it("knows which case waits", () => {
    const thread = [
      { role: "bot", metadata: { sunday_note_id: "s0", sunday_step: "case", offer: "sunday_note" }, body: "An older case." },
      { role: "bot", metadata: { sunday_note_id: "s0", sunday_step: "dismiss" }, body: "Noted." },
      { role: "bot", metadata: { sunday_note_id: "s1", sunday_step: "case", offer: "sunday_note" }, body: CASE },
    ];
    expect(sundayAskOf(thread)).toBe("s1");
    expect(sundayWaiting(thread, "s0")).toBe(false);
    expect(sundayWaiting(thread, "s1")).toBe(true);
  });
});
