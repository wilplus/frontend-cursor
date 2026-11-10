// @vitest-environment jsdom
/*
STORY    As a speaker, I want the phone's Back while I record to ask before it
         throws my Take away, and "Try processing again" to mean the Take on
         my screen, so that I never lose a Take by mistake and an old Take's
         text never comes back as my new one.
OUTCOME
  O1  Back while recording asks the ✕'s "Discard this take?": the screens
      stay and the mic keeps recording. Back again keeps the Take, as
      Escape does, and a third Back asks again; "Discard take" then closes.
  O2  After "Record again" on a slow Take, a failed upload's "Try
      processing again" sends the new Take again, with the new Take's
      upload key, and never restarts the old one, whose "Processing" line
      keeps tracking it.
  O3  The ✕ on the processing screen while the Take is still going up
      closes the screens, and the chat says at once that the Take is on its
      way; once the server has it the chat still gets it: its "Your
      Recording" line and the marker the chat follows.
PROVES   O1 -> "Back while recording asks first, and the Take keeps recording"
         O2 -> "after Record again, Try processing again sends the new Take, never the old one"
         O3 -> "the ✕ while the Take goes up still brings it to the chat"
WHY      Founder 2026-11-09, backend N560 items 1 and 2 ("Ask, like the ✕";
         "Yes, fix it"): Back threw the Take away without asking, and the
         retry could restart the old Take (Never 3, Never 5). O3: founder
         2026-11-10, "the takes are not being displayed on the chat and when
         I click to close the processing screen it doesn't show me the
         loading progress bubble"; "if I close the processing earlier there
         is no indication that it is processing" (Never 3).
*/
import { act, createElement, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The microphone: Finish hands over a new recording each time. */
const mic = vi.hoisted(() => {
  let set: (state: unknown) => void = () => undefined;
  let takes = 0;
  return {
    bind(next: (state: unknown) => void) {
      set = next;
    },
    start: vi.fn(async () => set({ status: "recording", partialText: "" })),
    stop: vi.fn(async () => undefined),
    cancel: vi.fn(() => set({ status: "idle" })),
    finish(): Blob {
      takes += 1;
      const audioBlob = new Blob([`take ${takes}`], { type: "audio/webm" });
      set({ status: "stopped", finalText: "", audioBlob, durationSec: 42 });
      return audioBlob;
    },
  };
});
vi.mock("@/hooks/useDualCaptureMic", async () => {
  const { useState: useMicState } = await import("react");
  return {
    lastMicWasEarbuds: () => false,
    useDualCaptureMic: () => {
      const [state, setState] = useMicState<unknown>({ status: "idle" });
      mic.bind(setState);
      return {
        state,
        start: mic.start,
        stop: mic.stop,
        cancel: mic.cancel,
        getAudioStartedAt: () => null,
        getPausedMs: () => 0,
      };
    },
  };
});

const api = vi.hoisted(() => ({
  submitLabRecording: vi.fn(),
  retryLabProcessing: vi.fn(async () => true),
}));
vi.mock("@/services/api/labRecording", async (original) => ({
  ...(await original<typeof import("@/services/api/labRecording")>()),
  submitLabRecording: api.submitLabRecording,
  retryLabProcessing: api.retryLabProcessing,
}));
vi.mock("@/services/api/projects", async (original) => ({
  ...(await original<typeof import("@/services/api/projects")>()),
  readGuestOwnerToken: () => "guest-owner",
  createProject: vi.fn(),
}));

/** A guest: the wait stays on these screens, where "Record again" lives. */
vi.mock("./useSignedIn", () => ({ useSignedIn: () => false }));
vi.mock("./useUserId", () => ({ useUserId: () => null }));
const thread = vi.hoisted(() => ({ append: vi.fn(async (_draft: unknown) => undefined), reload: async () => undefined }));
vi.mock("./LoungeThreadContext", () => ({ useLoungeThreadCtx: () => thread }));
const entry = vi.hoisted(() => ({
  status: { kind: "authorized" },
  fresh: true,
  attempt: 0,
  readAgain: () => undefined,
  accepted: () => undefined,
}));
vi.mock("./LabEntryGate", () => ({
  useLabEntry: () => entry,
  LabEntryGate: ({ children }: { children?: unknown }) => children,
}));
vi.mock("./useLabReadoutLive", () => ({ useLabReadoutLive: () => undefined }));
vi.mock("./useDocumentSettle", () => ({
  useDocumentSettle: () => ({ pending: false, takeIndex: null, arcId: null }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));

import LabOverlay from "./LabOverlay";
import { transition, type WillabEvent, type WillabState } from "./useWillabFlow";
import { writeExploreArc } from "@/lib/willab/exploreArc";
import { readProcessingTake } from "@/lib/willab/processingTake";
import { useTakeUploadingUnwatched } from "@/lib/willab/takeUploading";

/** What the chat reads: a Take still going up after its screens closed. */
let uploadingNow = false;
function UploadingProbe() {
  uploadingNow = useTakeUploadingUnwatched();
  return null;
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
/** The Lounge's onClose: the screens closed. */
const closed = vi.fn<() => void>();

/** The Lounge's side of the screens: the flow's own table moves them. */
function Lab() {
  const [state, setState] = useState<WillabState>("lab_prerecord");
  const [open, setOpen] = useState(true);
  const dispatch = useCallback((event: WillabEvent) => setState((now) => transition(now, event).to), []);
  if (!open) return null;
  return createElement(LabOverlay, {
    state,
    sessionId: null,
    dispatch,
    onClose: () => {
      closed();
      setOpen(false);
    },
  });
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });

/** Take 2 of a project, set up already: the Take starts by itself. */
async function openLaterTake() {
  writeExploreArc(null, "arc-1", 2, {
    topic: "Quarterly update",
    audience: null,
    presentationRef: null,
    slides: [],
    targetLengthSeconds: null,
  });
  act(() => root.render(createElement("div", null, createElement(Lab), createElement(UploadingProbe))));
  await settle();
  expect(recording()).toBe(true);
}

const recording = () => host.querySelector('[data-testid="recording-where"]') !== null;
const asking = () => (document.body.textContent ?? "").includes("Discard this take?");
const button = (label: string) =>
  Array.from(document.body.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label);

/** The phone's Back: the iPhone's edge swipe, Android's Back. */
async function back() {
  const popped = new Promise((done) => window.addEventListener("popstate", done, { once: true }));
  window.history.back();
  await popped;
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  closed.mockClear();
  mic.start.mockClear();
  mic.cancel.mockClear();
  api.submitLabRecording.mockReset();
  api.retryLabProcessing.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(async () => {
  vi.useRealTimers();
  act(() => root.unmount());
  // The screens' own history step lands while nothing is mounted.
  await new Promise((done) => setTimeout(done, 30));
  host.remove();
});

describe("the recording screens never lose a Take by mistake (backend N560)", () => {
  it("Back while recording asks first, and the Take keeps recording", async () => {
    await openLaterTake();
    mic.cancel.mockClear();

    await back();
    expect(asking()).toBe(true);
    expect(recording()).toBe(true);
    expect(mic.cancel).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();

    // Back again is the safe answer, as Escape is: the Take is kept.
    await back();
    expect(asking()).toBe(false);
    expect(recording()).toBe(true);
    expect(closed).not.toHaveBeenCalled();

    // Still caught: the next Back asks again, and its Discard closes.
    await back();
    expect(asking()).toBe(true);
    await act(async () => button("Discard take")!.click());
    expect(mic.cancel).toHaveBeenCalled();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("after Record again, Try processing again sends the new Take, never the old one", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    api.submitLabRecording
      .mockResolvedValueOnce({ kind: "processing", sessionId: "old-take", arcId: "arc-1", takeIndex: 2, takeCount: 2 })
      .mockResolvedValue({ kind: "error", status: 0, message: "We couldn't reach the server." });
    await openLaterTake();

    // The old Take is accepted, then takes longer than usual.
    await act(async () => void mic.finish());
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(180_000);
    });
    await settle();
    await act(async () => button("Record again")!.click());
    await settle();
    expect(recording()).toBe(true);

    // The new Take's upload fails; the speaker tries again.
    let newTake: Blob | null = null;
    await act(async () => {
      newTake = mic.finish();
    });
    await settle();
    await act(async () => button("Try processing again")!.click());
    await settle();

    expect(api.retryLabProcessing).not.toHaveBeenCalled();
    const sent = api.submitLabRecording.mock.calls.map(([input]) => input as { audioBlob: Blob; uploadIdempotencyKey: string });
    expect(sent).toHaveLength(3);
    const [oldTry, newTry, again] = sent;
    expect(again.audioBlob).toBe(newTake);
    // A repeat of the new Take is a duplicate on the server, never a second one.
    expect(again.uploadIdempotencyKey).toBe(newTry.uploadIdempotencyKey);
    expect(again.uploadIdempotencyKey).not.toBe(oldTry.uploadIdempotencyKey);
    // The old Take still finishes on the server, and its line tracks it.
    expect(readProcessingTake(null)?.sessionId).toBe("old-take");
  });

  it("the ✕ while the Take goes up still brings it to the chat", async () => {
    let answer: (value: unknown) => void = () => undefined;
    api.submitLabRecording.mockImplementationOnce(() => new Promise((done) => (answer = done)));
    thread.append.mockClear();
    await openLaterTake();

    await act(async () => void mic.finish());
    await settle();
    expect(api.submitLabRecording).toHaveBeenCalledTimes(1);
    await act(async () => document.body.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    await settle();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(uploadingNow).toBe(true);

    // The server answers after the screens are gone.
    await act(async () => answer({ kind: "processing", sessionId: "take-2", arcId: "arc-1", takeIndex: 2, takeCount: 2 }));
    await settle();

    expect(uploadingNow).toBe(false);
    expect(readProcessingTake(null)).toMatchObject({ sessionId: "take-2", arcId: "arc-1", takeIndex: 2, status: "processing" });
    const lines = thread.append.mock.calls.map(([draft]) => draft as { kind: string; metadata?: Record<string, unknown> });
    expect(lines.some((d) => d.kind === "recording_summary")).toBe(true);
  });
});
