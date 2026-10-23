// @vitest-environment jsdom
/*
STORY    As a speaker, I want the mic to record the moment I press start and to hand over a real recording and free the mic when I stop, so that every Take is captured.
OUTCOME
  O1  Start asks for the mic once, starts recording at once and notes when the sound began.
  O2  Stop hands over a recording that is not empty and releases the mic.
  O3  One tap on Finish is enough: the Take is handed over within a moment,
      and not empty, even when the browser is slow to deliver the last of the
      audio and Finish is tapped twice.
  O4  The phone's screen stays on while the Take records, so it cannot lock
      and cut the mic off; it may lock again once the Take ends.
PROVES   O1 -> records at once on start
         O2 -> hands over a real take on stop and releases the stream
         O3 -> hands over the take at once when the audio comes late and Finish is tapped twice
         O4 -> keeps the screen awake while recording and lets it lock after
WHY      Never-rule 3 (never break record → process → Ideal Text).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDualCaptureMic, type DualCaptureMic } from "./useDualCaptureMic";

let root: Root;
let host: HTMLDivElement;
let mic: DualCaptureMic;
let recorders: FakeRecorder[] = [];
let tracks: { readyState: string; stop: ReturnType<typeof vi.fn> }[] = [];
let getUserMedia: ReturnType<typeof vi.fn>;
/** How long after stop() the fake browser delivers the audio (0 = at once). */
let deliverAfterMs = 0;

class FakeRecorder {
  static isTypeSupported = () => true;
  state = "inactive";
  tick: ReturnType<typeof setInterval> | undefined;
  start = vi.fn((timeslice?: number) => {
    this.state = "recording";
    this.onstart?.();
    // Like a browser: with a timeslice, a chunk of audio every timeslice.
    if (timeslice) {
      this.tick = setInterval(
        () => this.ondataavailable?.({ data: new Blob(["x"]) }),
        timeslice,
      );
    }
  });
  stop = vi.fn(() => {
    // Like a browser: the recorder is inactive at once, its audio comes after.
    this.state = "inactive";
    clearInterval(this.tick);
    const deliver = () => {
      this.ondataavailable?.({ data: new Blob(["x"]) });
      this.onstop?.();
    };
    if (deliverAfterMs > 0) setTimeout(deliver, deliverAfterMs);
    else deliver();
  });
  onstart: (() => void) | null = null;
  onstop: (() => void) | null = null;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  constructor() {
    recorders.push(this);
  }
}

function Probe() {
  mic = useDualCaptureMic({ transcript: false });
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  recorders = [];
  tracks = [];
  deliverAfterMs = 0;
  getUserMedia = vi.fn(async () => {
    const track = { readyState: "live", stop: vi.fn() };
    tracks.push(track);
    return { getTracks: () => [track] };
  });
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
  act(() => root.render(createElement(Probe)));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(navigator, "wakeLock");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the Lab's mic", () => {
  it("records at once on start", async () => {
    await act(async () => {
      await mic.start();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(recorders[0].start).toHaveBeenCalledTimes(1);
    expect(mic.state.status).toBe("recording");
    expect(mic.getAudioStartedAt()).not.toBeNull();
  });

  it("hands over a real take on stop and releases the stream", async () => {
    await act(async () => {
      await mic.start();
    });
    await act(async () => {
      await mic.stop();
    });
    expect(mic.state.status).toBe("stopped");
    if (mic.state.status === "stopped") {
      expect(mic.state.audioBlob.size).toBeGreaterThan(0);
    }
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it("hands over the take at once when the audio comes late and Finish is tapped twice", async () => {
    vi.useFakeTimers();
    deliverAfterMs = 1500;
    await act(async () => {
      await mic.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500); // the speaker talks
    });
    await act(async () => {
      void mic.stop();
      void mic.stop();
      await vi.advanceTimersByTimeAsync(700); // one tap's wait, not the phone's
    });
    expect(mic.state.status).toBe("stopped");
    if (mic.state.status === "stopped") {
      expect(mic.state.audioBlob.size).toBeGreaterThan(0);
    }
  });

  it("keeps the screen awake while recording and lets it lock after", async () => {
    const release = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({ release }));
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
    await act(async () => {
      await mic.start();
    });
    expect(request).toHaveBeenCalledWith("screen");
    expect(release).not.toHaveBeenCalled();
    await act(async () => {
      await mic.stop();
    });
    expect(release).toHaveBeenCalled();
  });
});
