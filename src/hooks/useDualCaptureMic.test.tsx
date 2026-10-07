// @vitest-environment jsdom
/* The held mic behind Take 1's learning screen (founder lock 2026-10-07).
   The setup tap opens the mic (the permission prompt rides that tap) but
   records nothing; the speaker's start gesture begins the recording on that
   same stream, at once. LIVE LOOP: the stream is released on cancel, and a
   held mic never hands an empty take to stop(). */
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

describe("the held mic (Take 1's learning screen)", () => {
  it("opens the mic on arm, but records nothing", async () => {
    await act(async () => {
      await mic.start({ arm: true });
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(recorders).toHaveLength(1);
    expect(recorders[0].start).not.toHaveBeenCalled();
    expect(mic.armed).toBe(true);
    expect(mic.state.status).toBe("idle");
  });

  it("begins recording on the held stream in the same call as the gesture", async () => {
    await act(async () => {
      await mic.start({ arm: true });
    });
    act(() => {
      void mic.start();
    });
    // Synchronous: no second permission prompt, no await before capture.
    expect(recorders[0].start).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(mic.state.status).toBe("recording");
    expect(mic.armed).toBe(false);
    expect(mic.getAudioStartedAt()).not.toBeNull();
  });

  it("records a real take from there, as any start does", async () => {
    await act(async () => {
      await mic.start({ arm: true });
    });
    act(() => {
      void mic.start();
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

  it("opens the mic afresh when the held track has ended", async () => {
    await act(async () => {
      await mic.start({ arm: true });
    });
    tracks[0].readyState = "ended";
    await act(async () => {
      await mic.start();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(recorders[1].start).toHaveBeenCalledTimes(1);
    expect(mic.state.status).toBe("recording");
  });

  it("releases the held stream on cancel, and stop() never makes an empty take", async () => {
    await act(async () => {
      await mic.start({ arm: true });
    });
    await act(async () => {
      await mic.stop();
    });
    expect(mic.state.status).toBe("idle");
    act(() => mic.cancel());
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(mic.armed).toBe(false);
  });

  it("a plain start still records at once (later Takes)", async () => {
    await act(async () => {
      await mic.start();
    });
    expect(recorders[0].start).toHaveBeenCalledTimes(1);
    expect(mic.state.status).toBe("recording");
    expect(mic.armed).toBe(false);
  });
});
