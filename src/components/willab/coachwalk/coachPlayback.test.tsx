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
