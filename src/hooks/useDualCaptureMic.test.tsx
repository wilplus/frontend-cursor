// @vitest-environment jsdom
/* The Lab's mic (LIVE LOOP): start() records at once, every Take (N70),
   and stop() hands over a real take and releases the stream. */
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

class FakeRecorder {
  static isTypeSupported = () => true;
  state = "inactive";
  start = vi.fn(() => {
    this.state = "recording";
    this.onstart?.();
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["x"]) });
    this.onstop?.();
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
});
