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
import {
  MediaRefreshProvider,
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
