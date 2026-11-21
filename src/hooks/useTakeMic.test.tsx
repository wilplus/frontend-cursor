// @vitest-environment jsdom
/*
STORY    As a speaker in the iPhone app, I want my Take recorded by the phone
         itself, with my voice as it is, and everything else exactly as a web
         Take, so that nothing I rely on changes (backend N655, N662).
OUTCOME
  O1  Only the app with the native recorder and the switch on records
      natively; a browser, an older app or the switch off keep the web
      recorder.
  O2  The phone's Take is handed over as an m4a with its recorded length; a
      call pauses the clock the slides are timed on and the paused time is
      counted; the phone lets go of its copy once the web has it.
  O3  Earbuds are remembered by the kind of mic, for the line before the
      next Take (N372).
  O4  Discard keeps nothing, and a Finish while the mic is still opening
      leaves the mic off and hands over an empty try.
  O5  A refused microphone shows today's words, never new ones.
PROVES   O1 -> records natively only in the app with the plugin and the switch on
         O2 -> hands over the phone's m4a with a call's pause counted
         O3 -> remembers earbuds by the kind of mic
         O4 -> discard keeps nothing; a Finish while opening leaves the mic off
         O5 -> a refused microphone says today's words
WHY      Never-rule 3 (record → process → Ideal Text) and Never-rule 4.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ native: false, plugin: false, features: new Set<string>() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => env.native,
    isPluginAvailable: (name: string) => env.plugin && name === "TakeRecorder",
  },
  registerPlugin: () => ({}),
}));
vi.mock("@/services/api/rings", () => ({
  loadRingState: async () => ({ featuresOn: env.features }),
}));

import { lastMicWasEarbuds, type DualCaptureMic } from "./useDualCaptureMic";
import { useNativeTakeMic } from "./useNativeTakeMic";
import { recordsNatively } from "./useTakeMic";
import type { TakeRecorderPlugin } from "@/lib/willab/nativeTakeRecorder";

type Listener = () => void;

function fakePhone(opts: { micKind?: string; startDelayMs?: number; deny?: boolean } = {}) {
  const listeners: Record<string, Listener[]> = { paused: [], resumed: [] };
  const audio = btoa("m4a-bytes");
  const plugin = {
    start: vi.fn(async () => {
      if (opts.startDelayMs) await new Promise((r) => setTimeout(r, opts.startDelayMs));
      if (opts.deny) throw Object.assign(new Error("denied"), { code: "DENIED" });
      return { sinceFirstSampleMs: 30, micKind: opts.micKind ?? "builtIn" };
    }),
    stop: vi.fn(async () => ({ path: "/take.m4a", durationMs: 61_500, bytes: 9, mimeType: "audio/mp4" })),
    cancel: vi.fn(async () => undefined),
    read: vi.fn(async () => ({ data: audio })),
    release: vi.fn(async () => undefined),
    addListener: vi.fn(async (event: "paused" | "resumed", l: Listener) => {
      listeners[event].push(l);
      return { remove: async () => undefined };
    }),
    fire: (event: "paused" | "resumed") => listeners[event].forEach((l) => l()),
  };
  return plugin;
}

let root: Root;
let host: HTMLDivElement;
let mic: DualCaptureMic;

function mount(plugin: ReturnType<typeof fakePhone>) {
  function Probe() {
    mic = useNativeTakeMic(plugin as unknown as TakeRecorderPlugin);
    return null;
  }
  act(() => root.render(createElement(Probe)));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  env.native = false;
  env.plugin = false;
  env.features = new Set();
  window.localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("the Take's recorder in the iPhone app", () => {
  it("records natively only in the app with the plugin and the switch on", async () => {
    expect(await recordsNatively()).toBe(false); // a browser
    env.native = true;
    env.features = new Set(["native_take"]);
    expect(await recordsNatively()).toBe(false); // an app without the plugin
    env.plugin = true;
    env.features = new Set();
    expect(await recordsNatively()).toBe(false); // the switch off
    env.features = new Set(["native_take"]);
    expect(await recordsNatively()).toBe(true);
  });

  it("hands over the phone's m4a with a call's pause counted", async () => {
    vi.useFakeTimers();
    const phone = fakePhone();
    mount(phone);
    await act(async () => mic.start());
    expect(phone.start).toHaveBeenCalledWith({ bitrate: 64_000, sampleRate: 48_000 });
    expect(mic.state.status).toBe("recording");
    expect(mic.getAudioStartedAt()).not.toBeNull();

    act(() => phone.fire("paused"));
    vi.advanceTimersByTime(5_000);
    act(() => phone.fire("resumed"));
    expect(mic.getPausedMs()).toBeGreaterThanOrEqual(5_000);

    await act(async () => {
      await mic.stop();
    });
    expect(mic.state.status).toBe("stopped");
    if (mic.state.status !== "stopped") return;
    expect(mic.state.audioBlob.type).toBe("audio/mp4");
    expect(await mic.state.audioBlob.text()).toBe("m4a-bytes");
    expect(mic.state.durationSec).toBe(61.5);
    expect(phone.release).toHaveBeenCalledWith({ path: "/take.m4a" });
  });

  it("remembers earbuds by the kind of mic", async () => {
    const phone = fakePhone({ micKind: "bluetooth" });
    mount(phone);
    await act(async () => mic.start());
    expect(lastMicWasEarbuds()).toBe(true);
  });

  it("discard keeps nothing; a Finish while opening leaves the mic off", async () => {
    const phone = fakePhone();
    mount(phone);
    await act(async () => mic.start());
    act(() => mic.cancel());
    expect(phone.cancel).toHaveBeenCalled();
    expect(mic.state.status).toBe("idle");
    expect(phone.stop).not.toHaveBeenCalled();

    vi.useFakeTimers();
    const slow = fakePhone({ startDelayMs: 500 });
    mount(slow);
    let starting!: Promise<void>;
    act(() => {
      starting = mic.start();
    });
    await act(async () => mic.stop());
    expect(mic.state.status).toBe("stopped");
    if (mic.state.status === "stopped") expect(mic.state.audioBlob.size).toBe(0);
    await act(async () => {
      vi.advanceTimersByTime(500);
      await starting;
    });
    expect(slow.cancel).toHaveBeenCalled();
    expect(mic.state.status).toBe("stopped");
  });

  it("a refused microphone says today's words", async () => {
    const phone = fakePhone({ deny: true });
    mount(phone);
    await act(async () => mic.start());
    expect(mic.state).toEqual({
      status: "error",
      code: "denied",
      message: "Microphone blocked. Open iPhone Settings, find WillpowerLab, and turn on Microphone.",
    });
  });
});
