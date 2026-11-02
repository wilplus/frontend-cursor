// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want every short recording in the app to look and
 *          work the same, so that I always know how to stop and send, or
 *          throw it away.
 * OUTCOME
 *   O1  A voice note in the Lounge and a voice answer to the plan record
 *       with one bar (backend N314, N304): the trash on the left, then the
 *       walk's strip (the dot, the clock, the track) with the red Stop
 *       inside it. Stop sends the recording; the trash throws it away and
 *       sends nothing. The WhatsApp-style bar (a black send) and the plan's
 *       separate large Stop are gone.
 * PROVES   O1 -> "a voice note and a plan answer record with one bar: Stop
 *                 sends, the trash throws it away"
 * WHY      Founder 2026-10-31 (N304): "unify the recording pls just like it
 *          is here"; N314: "Can you make it locked everywhere?".
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const notebookApi = vi.hoisted(() => ({
  getNotebookState: vi.fn(),
  askNotebook: vi.fn(),
  answerNotebook: vi.fn(),
  sendVoiceNote: vi.fn(),
  hearPiece: vi.fn(async () => null),
  fixVoiceNote: vi.fn(),
  answerSalesStep: vi.fn(),
}));
vi.mock("@/services/api/voiceNotebook", () => notebookApi);

import { useVoiceNotebook, VoiceNoteBar, type VoiceNotebook } from "./useVoiceNotebook";
import PlanDock, { type PlanActions } from "./plan/PlanDock";
import type { Plan } from "@/services/api/plan";

/** A mic that records whatever the test says. */
class FakeRecorder {
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  static isTypeSupported = () => true;
  start() {
    this.state = "recording";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => this.onstop?.());
  }
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    configurable: true,
  });
  notebookApi.getNotebookState.mockResolvedValue({ enabled: true, consented: true, max_seconds: 300 });
  notebookApi.sendVoiceNote.mockResolvedValue({ kind: "kept", clientId: "row-1" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function flush() {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
}

/** The one bar: the trash, then the strip with Stop inside it, no send. */
function oneBar(scope: Element) {
  const bar = scope.querySelector("[data-recording-bar]");
  expect(bar).not.toBeNull();
  const trash = bar!.querySelector('button[aria-label="Delete"]') as HTMLButtonElement;
  const strip = bar!.querySelector("[data-walk-recording-strip]")!;
  const stop = strip.querySelector('button[aria-label="Stop"]') as HTMLButtonElement;
  expect(trash).not.toBeNull();
  expect(stop?.textContent).toBe("Stop");
  expect(bar!.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
  expect(trash.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // trash on the left
  expect(scope.querySelector('button[aria-label="Send"]')).toBeNull();
  return { trash, stop };
}

it("a voice note and a plan answer record with one bar: Stop sends, the trash throws it away", async () => {
  // The Lounge's voice note.
  let notebook: VoiceNotebook | null = null;
  function Note() {
    notebook = useVoiceNotebook({
      signedIn: true, threadLoading: false, held: false, drawn: [], openOffer: vi.fn(), reload: vi.fn(async () => undefined),
    });
    return createElement(VoiceNoteBar, { notebook });
  }
  await act(async () => root.render(createElement(Note)));
  await flush();
  await act(async () => notebook!.tapMic());
  await flush();
  const note = oneBar(host);
  await act(async () => note.stop.click());
  await flush();
  expect(notebookApi.sendVoiceNote).toHaveBeenCalledTimes(1);
  expect(host.querySelector("[data-recording-bar]")).toBeNull();

  // The plan's voice answer: the same bar, no "Your answer" line, no big Stop.
  const answer = vi.fn(async () => undefined);
  const actions = { answer } as unknown as PlanActions;
  const plan = { id: "p1", step: "why", status: "active", first_take_done: true } as unknown as Plan;
  act(() => root.render(createElement(PlanDock, { plan, busy: false, booking: null, onCloseBooking: vi.fn(), actions })));
  await act(async () => (host.querySelector("[data-plan-dock='record']") as HTMLButtonElement).click());
  await flush();
  const planBar = oneBar(host.querySelector("[data-plan-dock='recording']")!);
  expect(host.textContent).not.toContain("Your answer");
  expect(host.querySelectorAll("button").length).toBe(2); // the trash and Stop, nothing else
  await act(async () => planBar.trash.click());
  await flush();
  expect(answer).not.toHaveBeenCalled(); // thrown away
  await act(async () => (host.querySelector("[data-plan-dock='record']") as HTMLButtonElement).click());
  await flush();
  await act(async () => oneBar(host).stop.click());
  await flush();
  expect(answer).toHaveBeenCalledTimes(1);
});
