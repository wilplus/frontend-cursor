// @vitest-environment jsdom
/* The coach's players (founder 2026-10-08, "make sure the playbacks work all
   across the app"): the Take's word plays the re-signed link the API serves,
   never the stored ref, and asks for a fresh one when it dies; the blind
   lines' clips play only their window when the backend says where it is. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const word = vi.hoisted(() => ({
  fetchTakeWord: vi.fn(),
}));
vi.mock("@/services/api/coachWalk", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachWalk")>()),
  fetchTakeWord: word.fetchTakeWord,
}));

import CoachTakeWordSheet from "./CoachTakeWordSheet";
import { Audio } from "./CoachBlindSheet";
import { mapBlockPickQueue, mapErrorAuditQueue } from "@/services/api/coachPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  word.fetchTakeWord.mockReset();
});

const PAGER = { index: 0, total: 1, onBack: () => undefined, onNext: () => undefined };

describe("A word for this Take", () => {
  it("plays the re-signed video link, not the stored ref, and refreshes it once", async () => {
    word.fetchTakeWord
      .mockResolvedValueOnce({ text: "Well done.", videoRef: "coach-videos/s1/word.mp4", videoUrl: "https://cdn.example/coach-videos/s1/word.mp4?sig=1", sharedAt: null })
      .mockResolvedValueOnce({ text: "Well done.", videoRef: "coach-videos/s1/word.mp4", videoUrl: "https://cdn.example/coach-videos/s1/word.mp4?sig=2", sharedAt: null });
    await act(async () => {
      root.render(
        <CoachTakeWordSheet sessionId="s1" pseudonym="P1" takeIndex={1} pager={PAGER}
          onClose={() => undefined} onSkip={() => undefined} onSent={() => undefined} />,
      );
    });
    const video = host.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("https://cdn.example/coach-videos/s1/word.mp4?sig=1");
    await act(async () => {
      video.dispatchEvent(new Event("error"));
    });
    expect(word.fetchTakeWord).toHaveBeenCalledTimes(2);
    expect(host.querySelector("video")!.getAttribute("src")).toBe("https://cdn.example/coach-videos/s1/word.mp4?sig=2");
  });
});

describe("the blind lines' clips", () => {
  it("map the clip's window when the backend sends it, and nothing when not", () => {
    const audit = mapErrorAuditQueue({
      items: [
        { audit_id: "a1", clip_id: "c1", audio_ref: "https://x/a.webm", start_offset_ms: 1200, duration_ms: 3400 },
        { audit_id: "a2", clip_id: "c2", audio_ref: "https://x/b.webm" },
      ],
    });
    expect(audit.items[0]).toMatchObject({ startOffsetMs: 1200, durationMs: 3400 });
    expect("startOffsetMs" in audit.items[1]).toBe(false);
    const picks = mapBlockPickQueue({
      items: [{ pick_id: "p1", clips: [{ clip_id: "c1", letter: "A", audio_ref: "https://x/a.webm", start_offset_ms: 0, duration_ms: 900 }] }],
    });
    expect(picks.items[0].clips[0]).toMatchObject({ startOffsetMs: 0, durationMs: 900 });
  });

  it("play only their window", async () => {
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    act(() => root.render(<Audio src="https://x/a.webm" startOffsetMs={2000} durationMs={1000} />));
    const audio = host.querySelector("audio")!;
    let t = 0;
    Object.defineProperty(audio, "currentTime", { get: () => t, set: (v: number) => { t = v; }, configurable: true });
    await act(async () => { audio.dispatchEvent(new Event("loadedmetadata")); });
    expect(t).toBe(2);
    t = 3.1;
    await act(async () => { audio.dispatchEvent(new Event("timeupdate")); });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(t).toBe(2);
  });

  it("play the whole file without a window, as before", async () => {
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    act(() => root.render(<Audio src="https://x/a.webm" />));
    const audio = host.querySelector("audio")!;
    Object.defineProperty(audio, "currentTime", { value: 99, writable: true, configurable: true });
    await act(async () => { audio.dispatchEvent(new Event("timeupdate")); });
    expect(pause).not.toHaveBeenCalled();
  });
});
