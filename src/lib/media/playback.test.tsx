// @vitest-environment jsdom
/*
 * STORY    As a speaker or coach, I want playback to fix an expired link by
 *          itself and only one player to play at a time, so that clips just work.
 * OUTCOME
 *   O1  An expired link asks the host once for a fresh one, and plays it.
 *   O2  If the fresh link fails too, the player shows "audio unavailable"
 *       and asks no more.
 *   O3  A tab coming back after more than 5 hours refreshes the links itself.
 *   O4  One player at a time: starting one pauses the other.
 *   O5  The clip clamp stops at the clip's end, and never cuts a file whose
 *       length is unknown.
 * PROVES   O1 -> "asks the host once, then plays the fresh link"
 *          O2 -> "a second failure shows unavailable"
 *          O3 -> "refreshes on its own when the tab comes back after hours"
 *          O4 -> "pauses the one playing when another starts"
 *          O5 -> "stops at the clip's end, but plays an unknown length to its end"
 * WHY      Founder 2026-10-08: "make sure the playbacks work all across the app".
 */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MediaPlayer from "@/components/results/MediaPlayer";
import { MEDIA_STALE_MS, MediaRefreshProvider } from "./mediaRefresh";
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

  it("a second failure shows unavailable", async () => {
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
    expect(host.querySelector("button")!.hasAttribute("disabled")).toBe(true);
  });
});

describe("a tab back after hours", () => {
  it("refreshes on its own when the tab comes back after hours", async () => {
    const refreshSpy = vi.fn();
    const start = Date.now();
    render(
      <Host frozen={OLD} next={NEW} refreshSpy={refreshSpy}>
        {(src) => <MediaPlayer src={src} durationMs={4000} />}
      </Host>,
    );
    // Back after a short while: nothing to do.
    vi.spyOn(Date, "now").mockReturnValue(start + 60_000);
    await fire(document, "visibilitychange");
    expect(refreshSpy).not.toHaveBeenCalled();
    // Back after the links have gone stale: one refresh, and the fresh link plays.
    vi.spyOn(Date, "now").mockReturnValue(start + MEDIA_STALE_MS + 60_000);
    await fire(document, "visibilitychange");
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(host.querySelector("audio")!.getAttribute("src")).toBe(NEW);
  });
});

describe("the clip clamp", () => {
  /** Put the playhead at `sec` and tell the player. */
  async function at(audio: HTMLAudioElement, sec: number) {
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: sec });
    await fire(audio, "timeupdate");
  }

  it("stops at the clip's end, but plays an unknown length to its end", async () => {
    render(<MediaPlayer src={OLD} durationMs={4000} />);
    const clipped = host.querySelector("audio")!;
    await at(clipped, 5);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);

    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    render(<MediaPlayer src={NEW} />);
    const unknown = host.querySelector("audio")!;
    Object.defineProperty(unknown, "duration", { configurable: true, value: Infinity });
    await fire(unknown, "loadedmetadata");
    await at(unknown, 600);
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
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
});
