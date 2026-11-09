// @vitest-environment jsdom
/*
STORY    As the founder, I want a note I said before the notebook rested to be kept, and the sale's question I was asked to still take my answer, so that nothing I said is lost.
OUTCOME
  O2  A note left on the phone waits under a clock and goes, once, when the connection is back (N194). Since N483 item 7 the note rests: nothing starts a new one, and the notes already said still go.
  O5  Under "Which step did it stall at?" the sale's four steps take the message box's place, and a tap answers for that note with that step (N241 P2).
  O6  The notebook rests (N483 item 7): opening the Lounge no longer asks Will to open it from my Takes, and "Keep a voice notebook?" no longer opens its answers.
PROVES   O2 -> keeps a note that cannot go and sends it once when back online
         O5 -> opens the four steps under the sales question and answers with the one tapped
         O6 -> the notebook rests: no intro and no ask
WHY      Founder 2026-10-20: the voice notebook; 2026-11-04 (N483): "I am ready to give up the option to record short messages in the chat and find for it another place".
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getNotebookState: vi.fn(),
  answerNotebook: vi.fn(),
  answerSunday: vi.fn(),
  sendVoiceNote: vi.fn(),
  hearPiece: vi.fn(),
  fixVoiceNote: vi.fn(),
  answerSalesStep: vi.fn(),
}));
vi.mock("@/services/api/voiceNotebook", () => api);
// Signed in as u1: the token's payload names them.
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => `h.${btoa(JSON.stringify({ sub: "u1" }))}.s` }));

import { SalesSteps, salesAskOf, useVoiceNotebook, VoiceNoteThread, type VoiceNotebook } from "./useVoiceNotebook";
import { keepNote } from "@/lib/willab/voiceNoteOutbox";

let container: HTMLDivElement;
let root: Root;
const reload = vi.fn(async () => undefined);
const openOffer = vi.fn();

function Harness({ drawn = [] }: { drawn?: { client_id: string; metadata: Record<string, unknown> }[] }) {
  const notebook = useVoiceNotebook({ signedIn: true, userId: "u1", threadLoading: false, held: false, drawn, openOffer, reload });
  return createElement(VoiceNoteThread, { notebook });
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  api.getNotebookState.mockResolvedValue({ enabled: true, consented: true, max_seconds: 300 });
  api.sendVoiceNote.mockResolvedValue({ kind: "kept", clientId: "row-1" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("a note already said", () => {
  it("keeps a note that cannot go and sends it once when back online", async () => {
    await keepNote({ key: "note-1", audio: new Blob(["a"], { type: "audio/webm" }), durationMs: 4000, words: "ask Marta for the mic", open: false, at: 1, owner: "u1" });
    api.sendVoiceNote.mockResolvedValueOnce({ kind: "retry" });
    await act(async () => root.render(createElement(Harness)));
    await settle(1000);

    expect(container.querySelector('[aria-label="Waiting to send"]')).not.toBeNull();
    expect(container.textContent).toContain("ask Marta for the mic");
    expect(reload).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await settle(1000);

    expect(api.sendVoiceNote).toHaveBeenCalledTimes(2);
    expect(api.sendVoiceNote.mock.calls[1]![2]).toBe("note-1");
    expect(container.querySelector('[aria-label="Waiting to send"]')).toBeNull();
    expect(reload).toHaveBeenCalled();
  });

  it("the notebook rests: no intro and no ask", async () => {
    api.getNotebookState.mockResolvedValue({ enabled: true, consented: false, max_seconds: 300 });
    await act(async () => root.render(createElement(Harness, { drawn: [{ client_id: "ask", metadata: { offer: "voice_notebook" } }] })));
    await settle();
    expect(openOffer).not.toHaveBeenCalled();
  });
});

describe("the sales question (N241 P2)", () => {
  it("opens the four steps under the sales question and answers with the one tapped", async () => {
    const ask = { client_id: "ask-s", metadata: { offer: "sales_step", sales_note: "n7" } };
    let nb: VoiceNotebook | null = null;
    function Box() {
      nb = useVoiceNotebook({ signedIn: true, userId: "u1", threadLoading: false, held: false, drawn: [ask], openOffer, reload });
      return createElement(SalesSteps, { onPick: (step) => nb?.answerSales(salesAskOf([ask]), step) });
    }
    api.answerSalesStep.mockResolvedValue(true);
    await act(async () => root.render(createElement(Box)));
    await settle();
    expect(openOffer).toHaveBeenCalledWith("sales_step");

    const steps = [...container.querySelectorAll('[data-testid="sales-steps"] button')];
    expect(steps.map((b) => b.textContent)).toEqual(["The opening", "Discovery", "The offer", "The follow-up"]);
    await act(async () => {
      (steps[2] as HTMLButtonElement).click();
    });
    await settle();
    expect(api.answerSalesStep).toHaveBeenCalledWith("n7", "offer");
    expect(reload).toHaveBeenCalled();
  });
});
