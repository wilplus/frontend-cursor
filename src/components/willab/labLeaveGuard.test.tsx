// @vitest-environment jsdom
/*
STORY    As a speaker, I want refreshing or closing the page by mistake while
         my Take is recorded, or before the server has it, to ask me first,
         so that I never lose a Take silently.
OUTCOME
  O1  While a Take records (paused by a call and finishing included), and
      while it goes up, the page's unload is held for the browser's own
      "Leave page?".
  O2  Once the server answers that it has the Take (201 or 202), nothing
      asks; a failed upload still asks.
  O3  Before Record nothing asks.
  O4  After "Discard this take?", and once the screens close, nothing asks.
PROVES   O1 -> "asks while a Take records and while it goes up"
         O2 -> "stops asking once the server has the Take, and keeps asking after a failed upload"
         O3 -> "asks nothing before Record"
         O4 -> "asks nothing after a discard, nor once the screens close"
WHY      Founder 2026-11-09, backend N553 item 1 ("Both: A now, B next"):
         a refresh or a close before the server confirmed the Take lost it.
         Never 3.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LabUploadResult } from "@/services/api/labRecording";
import { serverHasTake, takeNotYetAccepted, useLeaveGuard } from "./labLeaveGuard";

type TakeWindow = Parameters<typeof takeNotYetAccepted>[0];

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** The overlay's one line: the hook on the condition LabOverlay passes it. */
function Guarded(props: TakeWindow) {
  useLeaveGuard(takeNotYetAccepted(props));
  return null;
}

function show(props: TakeWindow) {
  act(() => root.render(createElement(Guarded, props)));
}

/** A refresh or a close: true when the page's unload is held. */
function leaveAsks(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

const take = new Blob(["voice"], { type: "audio/webm" });

describe("the browser's own leave warning (N553 item 1)", () => {
  it("asks while a Take records and while it goes up", () => {
    // Recording, a call's pause and Finish collecting the last audio are all
    // the mic's "recording".
    show({ state: "lab_recording", micStatus: "recording", blob: null, heldBlob: null });
    expect(leaveAsks()).toBe(true);
    // Finished, the moment before the upload takes it.
    show({ state: "lab_recording", micStatus: "stopped", blob: null, heldBlob: null });
    expect(leaveAsks()).toBe(true);
    show({ state: "lab_processing", micStatus: "stopped", blob: take, heldBlob: null });
    expect(leaveAsks()).toBe(true);
  });

  it("stops asking once the server has the Take, and keeps asking after a failed upload", () => {
    const failed: LabUploadResult = { kind: "error", status: 0, message: "offline" };
    expect(serverHasTake(failed)).toBe(false);
    show({ state: "lab_processing", micStatus: "stopped", blob: take, heldBlob: null });
    expect(leaveAsks()).toBe(true);

    const accepted: LabUploadResult = {
      kind: "processing",
      sessionId: "s1",
      arcId: "a1",
      takeIndex: 1,
      takeCount: 1,
    };
    expect(serverHasTake(accepted)).toBe(true);
    show({ state: "lab_processing", micStatus: "stopped", blob: take, heldBlob: take });
    expect(leaveAsks()).toBe(false);
    show({ state: "readout", micStatus: "stopped", blob: take, heldBlob: take });
    expect(leaveAsks()).toBe(false);
  });

  it("asks nothing before Record", () => {
    for (const state of ["lab_feelings", "lab_session_context", "lab_prerecord"] as const) {
      show({ state, micStatus: "idle", blob: null, heldBlob: null });
      expect(leaveAsks()).toBe(false);
    }
    // "Getting your mic ready" on the recording screen.
    show({ state: "lab_recording", micStatus: "idle", blob: null, heldBlob: null });
    expect(leaveAsks()).toBe(false);
  });

  it("asks nothing after a discard, nor once the screens close", () => {
    show({ state: "lab_processing", micStatus: "stopped", blob: take, heldBlob: null });
    expect(leaveAsks()).toBe(true);
    // Discard: the Take is dropped and the mic goes back to idle.
    show({ state: "lab_recording", micStatus: "idle", blob: null, heldBlob: null });
    expect(leaveAsks()).toBe(false);

    show({ state: "lab_recording", micStatus: "recording", blob: null, heldBlob: null });
    act(() => root.unmount());
    expect(leaveAsks()).toBe(false);
    act(() => {
      root = createRoot(host);
    });
  });
});
