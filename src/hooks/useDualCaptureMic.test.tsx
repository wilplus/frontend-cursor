// @vitest-environment jsdom
/*
STORY    As a speaker, I want the mic to record the moment I press start and to hand over a real recording and free the mic when I stop, so that every Take is captured.
OUTCOME
  O1  Start asks for the mic once, starts recording at once and notes when the sound began.
  O2  Stop hands over a recording that is not empty and releases the mic.
  O3  The whole Take is handed over even when the browser is slow to deliver
      it and Finish is tapped twice.
PROVES   O1 -> records at once on start
         O2 -> hands over a real take on stop and releases the stream
         O3 -> hands over the whole take when it arrives late and Finish is tapped twice
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
  start = vi.fn(() => {
    this.state = "recording";
    this.onstart?.();
  });
  stop = vi.fn(() => {
    // Like a browser: the recorder is inactive at once, its audio comes after.
    this.state = "inactive";
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

  it("hands over the whole take when it arrives late and Finish is tapped twice", async () => {
    vi.useFakeTimers();
    deliverAfterMs = 1500;
    await act(async () => {
      await mic.start();
    });
    await act(async () => {
      const first = mic.stop();
      const second = mic.stop();
      await vi.advanceTimersByTimeAsync(2000);
      await Promise.all([first, second]);
    });
    expect(mic.state.status).toBe("stopped");
    if (mic.state.status === "stopped") {
      expect(mic.state.audioBlob.size).toBeGreaterThan(0);
    }
  });
});
