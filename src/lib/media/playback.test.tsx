// @vitest-environment jsdom
/* Playback across the app (founder 2026-10-08, "make sure the playbacks work
   all across the app"): an expired link asks the host once for a fresh one
   and plays it; only a second failure shows the players' existing
   "unavailable"; a tab back after hours refreshes on its own; one player at
   a time; the clip clamp never cuts a file whose length is unknown. */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MediaPlayer from "@/components/results/MediaPlayer";
import SnippetWavePlayer from "@/components/willab/SnippetWavePlayer";
import CoachVideo from "@/components/willab/CoachVideo";
import NativeVideo from "@/components/willab/NativeVideo";
import {
  MEDIA_STALE_MS,
  MediaRefreshProvider,
  collectMediaLinks,
  freshestByKey,
  mediaKey,
} from "./mediaRefresh";
import { claimPlayback, releasePlayback } from "./exclusivePlayback";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OLD = "https://media.example/take/full.webm?X-Amz-Signature=old";
const NEW = "https://media.example/take/full.webm?X-Amz-Signature=new";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

function render(node: React.ReactNode) {
  act(() => root.render(node));
}

async function fire(el: EventTarget, type: string) {
  await act(async () => {
    el.dispatchEvent(new Event(type));
  });
}

/** A host holding one link, re-signed on refresh (as the backend's GET). */
function Host({
  frozen,
  next,
  refreshSpy,
  children,
}: {
  frozen: string;
  next: string;
  refreshSpy: () => void;
  children: (src: string) => React.ReactNode;
}) {
  const [payload, setPayload] = useState({ clip: frozen });
  const refresh = async () => {
    refreshSpy();
    setPayload({ clip: next });
  };
  return (
    <MediaRefreshProvider refresh={refresh} payload={payload}>
      {/* The child keeps the FROZEN link, as a sheet that froze its items. */}
      {children(frozen)}
    </MediaRefreshProvider>
  );
}

describe("the link helpers", () => {
  it("keys a link by its path, without the signature", () => {
    expect(mediaKey(OLD)).toBe("https://media.example/take/full.webm");
    expect(mediaKey(NEW)).toBe(mediaKey(OLD));
    expect(mediaKey("https://x.example/a.mp4")).toBe("https://x.example/a.mp4");
  });

  it("collects every absolute link in a payload, and nothing else", () => {
    const links = collectMediaLinks({ a: [OLD, { b: "plain words" }], c: 3, d: null, e: "/relative" });
    expect([...links]).toEqual([OLD]);
  });

  it("prefers the link first seen last, so a kept row maps to the fresh one", () => {
    const seen = new Map<string, number>();
    expect(freshestByKey([OLD], seen).get(mediaKey(OLD))).toBe(OLD);
    // The refetch's payload still holds the kept (old) row next to the new one.
    expect(freshestByKey([NEW, OLD], seen).get(mediaKey(OLD))).toBe(NEW);
    expect(freshestByKey([OLD, NEW], seen).get(mediaKey(OLD))).toBe(NEW);
  });
});

describe("an expired link (MediaPlayer)", () => {
  it("asks the host once, then plays the fresh link", async () => {
    const refreshSpy = vi.fn();
    render(
      <Host frozen={OLD} next={NEW} refreshSpy={refreshSpy}>
        {(src) => <MediaPlayer src={src} durationMs={4000} />}
      </Host>,
    );
    const audio = host.querySelector("audio")!;
    expect(audio.getAttribute("src")).toBe(OLD);
    await fire(audio, "error");
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(host.querySelector("audio")!.getAttribute("src")).toBe(NEW);
    expect(host.textContent).not.toContain("audio unavailable");
    expect(host.querySelector("button")!.hasAttribute("disabled")).toBe(false);
  });

  it("shows the existing unavailable state only when the fresh link fails too", async () => {
    const refreshSpy = vi.fn();
    render(
      <Host frozen={OLD} next={NEW} refreshSpy={refreshSpy}>
        {(src) => <MediaPlayer src={src} durationMs={4000} />}
      </Host>,
    );
    await fire(host.querySelector("audio")!, "error");
    await fire(host.querySelector("audio")!, "error");
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("audio unavailable");
  });

  it("shows unavailable when the refresh brings the same dead link", async () => {
    const refreshSpy = vi.fn();
    render(
      <Host frozen={OLD} next={OLD} refreshSpy={refreshSpy}>
        {(src) => <MediaPlayer src={src} durationMs={4000} />}
      </Host>,
    );
    await fire(host.querySelector("audio")!, "error");
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("audio unavailable");
  });

  it("without a host, an error is final, as before, and still told", async () => {
    const onError = vi.fn();
    render(<MediaPlayer src={OLD} durationMs={4000} onError={onError} />);
    await fire(host.querySelector("audio")!, "error");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("audio unavailable");
  });

  it("refreshes on its own when the tab comes back after more than 5 h", async () => {
    const refreshSpy = vi.fn();
    const start = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(start);
    render(
      <Host frozen={OLD} next={NEW} refreshSpy={refreshSpy}>
        {(src) => <MediaPlayer src={src} durationMs={4000} />}
      </Host>,
    );
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    now.mockReturnValue(start + 60 * 60 * 1000);
    await fire(document, "visibilitychange");
    expect(refreshSpy).not.toHaveBeenCalled();
    now.mockReturnValue(start + MEDIA_STALE_MS + 1);
    await fire(document, "visibilitychange");
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(host.querySelector("audio")!.getAttribute("src")).toBe(NEW);
  });
});

describe("the clip clamp and a new src (MediaPlayer)", () => {
  function audioAt(audio: HTMLAudioElement, currentTime: number, duration: number) {
    Object.defineProperty(audio, "currentTime", { value: currentTime, writable: true, configurable: true });
    Object.defineProperty(audio, "duration", { value: duration, configurable: true });
  }

  it("plays a file of unknown length to its natural end", async () => {
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    render(<MediaPlayer src={OLD} />);
    const audio = host.querySelector("audio")!;
    audioAt(audio, 0, Infinity);
    await fire(audio, "loadedmetadata");
    audioAt(audio, 7, Infinity);
    await fire(audio, "timeupdate");
    expect(pause).not.toHaveBeenCalled();
  });

  it("still stops at the clip's end when its length is known", async () => {
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    render(<MediaPlayer src={OLD} startOffsetMs={1000} durationMs={2000} />);
    const audio = host.querySelector("audio")!;
    audioAt(audio, 3.2, 60);
    await fire(audio, "timeupdate");
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("is not left 'playing' when its src changes", async () => {
    render(<MediaPlayer src={OLD} durationMs={2000} />);
    await fire(host.querySelector("audio")!, "play");
    expect(host.querySelector("button")!.getAttribute("aria-pressed")).toBe("true");
    render(<MediaPlayer src={NEW} durationMs={2000} />);
    expect(host.querySelector("button")!.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("SnippetWavePlayer", () => {
  it("tells its host on error and plays the fresh link", async () => {
    const refreshSpy = vi.fn();
    const onError = vi.fn();
    render(
      <Host frozen={OLD} next={NEW} refreshSpy={refreshSpy}>
        {(src) => <SnippetWavePlayer seed="m1" src={src} durationMs={3000} label="this moment" onError={onError} />}
      </Host>,
    );
    await fire(host.querySelector("audio")!, "error");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(host.querySelector("audio")!.getAttribute("src")).toBe(NEW);
    expect(host.textContent).not.toContain("unavailable");
  });

  it("is not left 'playing' when its src changes", async () => {
    render(<SnippetWavePlayer seed="m1" src={OLD} durationMs={3000} label="x" />);
    await fire(host.querySelector("audio")!, "play");
    expect(host.querySelector("button")!.getAttribute("aria-pressed")).toBe("true");
    render(<SnippetWavePlayer seed="m1" src={NEW} durationMs={3000} label="x" />);
    expect(host.querySelector("button")!.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("the coach's video", () => {
  it("hides the dead play button when no fresh link helps (no text added)", async () => {
    render(<CoachVideo src={OLD} />);
    expect(host.querySelector("button[aria-label='Play']")).not.toBeNull();
    const before = host.textContent;
    await fire(host.querySelector("video")!, "error");
    expect(host.querySelector("button[aria-label='Play']")).toBeNull();
    expect(host.textContent).toBe(before);
  });

  it("asks its host once and keeps the button with the fresh link", async () => {
    const refreshSpy = vi.fn();
    render(
      <Host frozen={OLD} next={NEW} refreshSpy={refreshSpy}>
        {(src) => <CoachVideo src={src} />}
      </Host>,
    );
    await fire(host.querySelector("video")!, "error");
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(host.querySelector("video")!.getAttribute("src")).toBe(NEW);
    expect(host.querySelector("button[aria-label='Play']")).not.toBeNull();
  });

  it("a native video that cannot play is not drawn", async () => {
    render(<NativeVideo src={OLD} className="w-full" />);
    const video = host.querySelector("video")!;
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.getAttribute("preload")).toBe("metadata");
    await fire(video, "error");
    expect(host.querySelector("video")).toBeNull();
  });
});

describe("one player at a time", () => {
  function fake(paused: boolean) {
    return { paused, pause: vi.fn() } as unknown as HTMLMediaElement & { pause: ReturnType<typeof vi.fn> };
  }

  it("pauses the one playing when another starts", () => {
    const a = fake(false);
    const b = fake(false);
    claimPlayback(a);
    claimPlayback(b);
    expect(a.pause).toHaveBeenCalledTimes(1);
    expect(b.pause).not.toHaveBeenCalled();
    releasePlayback(b);
  });

  it("leaves alone one already paused or released", () => {
    const a = fake(true);
    const b = fake(false);
    claimPlayback(a);
    claimPlayback(b);
    expect(a.pause).not.toHaveBeenCalled();
    const c = fake(false);
    releasePlayback(b);
    claimPlayback(c);
    expect(b.pause).not.toHaveBeenCalled();
    releasePlayback(c);
  });

  it("two players on one screen: starting the second pauses the first", async () => {
    render(
      <>
        <MediaPlayer src={OLD} durationMs={2000} />
        <SnippetWavePlayer seed="m2" src={NEW} durationMs={2000} label="x" />
      </>,
    );
    const [first, second] = Array.from(host.querySelectorAll("audio"));
    Object.defineProperty(first, "paused", { value: false, configurable: true });
    await fire(first, "play");
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    pause.mockClear();
    await fire(second, "play");
    expect(pause).toHaveBeenCalledTimes(1);
    expect(pause.mock.contexts[0]).toBe(first);
  });
});
