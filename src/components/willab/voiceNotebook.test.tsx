// @vitest-environment jsdom
/*
STORY    As the founder in a rush, I want to say a note and close the app, so that what I said is kept and I can see it was written as I meant it.
OUTCOME
  O1  The moment I tap, my note shows the wave of my voice; the words follow it; leaving the app sends the note, it is not thrown away (N194, N199).
  O2  A note that cannot leave the phone waits under a clock and goes, once, when the connection is back (N194).
PROVES   O1 -> shows the wave at once, then my words, and keeps the note when I leave the app
         O2 -> keeps a note that cannot go and sends it once when back online
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getNotebookState: vi.fn(),
  askNotebook: vi.fn(),
  answerNotebook: vi.fn(),
  answerSunday: vi.fn(),
  sendVoiceNote: vi.fn(),
  hearPiece: vi.fn(),
  fixVoiceNote: vi.fn(),
}));
vi.mock("@/services/api/voiceNotebook", () => api);

import { useVoiceNotebook, VoiceNoteThread, type VoiceNotebook } from "./useVoiceNotebook";

/** A mic and recorders that only do what the test tells them. */
class FakeRecorder {
  static all: FakeRecorder[] = [];
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  static isTypeSupported = () => true;
  constructor() {
    FakeRecorder.all.push(this);
  }
  start() {
    this.state = "recording";
  }
  say(text: string) {
    this.ondataavailable?.({ data: new Blob([text], { type: "audio/webm" }) });
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => this.onstop?.());
  }
}

let container: HTMLDivElement;
let root: Root;
let notebook: VoiceNotebook;
const reload = vi.fn(async () => undefined);

function Harness() {
  notebook = useVoiceNotebook({ signedIn: true, threadLoading: false, drawn: [], openOffer: vi.fn(), reload });
  return createElement(VoiceNoteThread, { notebook });
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  FakeRecorder.all = [];
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    configurable: true,
  });
  api.getNotebookState.mockResolvedValue({ enabled: true, consented: true, max_seconds: 300 });
  api.sendVoiceNote.mockResolvedValue({ kind: "kept", clientId: "row-1" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(Harness)));
  await settle();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setVisibility("visible");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function startNote() {
  await act(async () => {
    notebook.tapMic();
  });
  await settle();
  const [main, piece] = FakeRecorder.all;
  return { main: main!, piece: piece! };
}

describe("the voice note, written as it is said", () => {
  it("shows the wave at once, then my words, and keeps the note when I leave the app", async () => {
    api.hearPiece.mockResolvedValue("um so the opening felt rushed");
    const { main, piece } = await startNote();
    // Before anything is heard back: the wave, from the phone alone.
    expect(container.querySelector('[data-testid="voice-note-wave"]')).not.toBeNull();
    expect(api.hearPiece).not.toHaveBeenCalled();
    main.say("a");
    piece.say("a");
    await settle(1500);
    expect(container.textContent).toContain("so the opening felt rushed");

    main.say("b");
    setVisibility("hidden");
    await settle(1000);

    expect(api.sendVoiceNote).toHaveBeenCalledTimes(1);
    const [audio, , key] = api.sendVoiceNote.mock.calls[0]!;
    expect((audio as Blob).size).toBeGreaterThan(0);
    expect(typeof key).toBe("string");
    expect(reload).toHaveBeenCalled();
  });

  it("keeps a note that cannot go and sends it once when back online", async () => {
    api.hearPiece.mockResolvedValue("ask Marta for the mic");
    api.sendVoiceNote.mockResolvedValueOnce({ kind: "retry" });
    const { main, piece } = await startNote();
    main.say("a");
    piece.say("a");
    await settle(1500);
    await act(async () => notebook.note.send());
    await settle(1000);

    expect(container.querySelector('[aria-label="Waiting to send"]')).not.toBeNull();
    expect(container.textContent).toContain("ask Marta for the mic");
    expect(reload).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await settle(1000);

    expect(api.sendVoiceNote).toHaveBeenCalledTimes(2);
    expect(api.sendVoiceNote.mock.calls[1]![2]).toBe(api.sendVoiceNote.mock.calls[0]![2]);
    expect(container.querySelector('[aria-label="Waiting to send"]')).toBeNull();
    expect(reload).toHaveBeenCalled();
  });
});
