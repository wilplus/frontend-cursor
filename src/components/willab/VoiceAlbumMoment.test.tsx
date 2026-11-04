// @vitest-environment jsdom
/*
STORY    As a speaker opening a moment in my Voice Album, I want to see the
         whole history behind it, so that I can see where it came from.
OUTCOME
  O1  Opening History loads the moment's history and shows its events;
      it never stays on the spinner once the history has arrived.
PROVES   O1 -> "opening History shows the history's events"
WHY      Founder 2026-09-18: "I want the whole history". An earlier build
         dropped the answer and spun forever.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MomentHistory, VoiceAlbumEntry } from "@/services/api/voiceAlbum";

const fetchMomentHistory = vi.fn<(projectId: string, momentKey: string) => Promise<MomentHistory | null>>();

vi.mock("@/services/api/voiceAlbum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/voiceAlbum")>()),
  fetchMomentHistory: (projectId: string, momentKey: string) =>
    fetchMomentHistory(projectId, momentKey),
}));

const { default: VoiceAlbumMoment } = await import("./VoiceAlbumMoment");

const entry: VoiceAlbumEntry = {
  projectId: "p1",
  momentKey: "snip-1",
  takeSessionId: null,
  takeIndex: 3,
  slideIndex: 2,
  enteredAt: null,
  audioUrl: null,
  startOffsetMs: null,
  durationMs: null,
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  fetchMomentHistory.mockReset();
});

describe("VoiceAlbumMoment", () => {
  it("opening History shows the history's events", async () => {
    fetchMomentHistory.mockResolvedValue({
      momentKey: "snip-1",
      origin: { takeIndex: 3, slideIndex: 2, at: null, source: "snippet" },
      events: [
        { kind: "owner_answer", who: "You", at: null, response: "yes" },
        { kind: "coach_agreed", who: "Your coach", at: null },
        { kind: "note", who: "You", at: null, body: "Slower here worked.", noteId: "n1" },
      ],
    });

    await act(async () => {
      root.render(
        createElement(VoiceAlbumMoment, {
          projectId: "p1",
          entry,
          open: true,
          onToggle: () => {},
        })
      );
    });

    expect(fetchMomentHistory).toHaveBeenCalledWith("p1", "snip-1");
    const text = host.textContent ?? "";
    expect(text).toContain("Yes — Confident");
    expect(text).toContain("heard the same thing");
    expect(text).toContain("Slower here worked.");
  });
});
