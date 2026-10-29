// @vitest-environment jsdom
/*
STORY    As a guest whose first Take is processed, I want to hear one real
         piece of my result on the account wall, so that I know what an
         account keeps for me.
OUTCOME
  O1  The wall plays the clip of the Take's most confident moment, the one
      the walk praises first, with "This was your most confident moment."
  O2  With no such moment (or no clip), the wall is exactly as before.
PROVES   O1 -> "shows the most confident moment's clip and the walk's line"
         O2 -> "is unchanged when the Take has no praised most confident moment"
WHY      Founder 2026-10-29, backend N273 item 5.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DocumentSuggestion } from "@/services/api/idealText";
import ReadySignUpScreen from "./ReadySignUpScreen";
import { wallMomentOf } from "./wallMoment";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (over: Partial<DocumentSuggestion>): DocumentSuggestion =>
  ({
    id: "s1",
    start: 0,
    blockId: "b1",
    bookmarkTier: "confident",
    snippetId: "snip-1",
    snippetAudioRef: "https://media.example/take.webm",
    startOffsetMs: 1200,
    durationMs: 4000,
    ...over,
  }) as unknown as DocumentSuggestion;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function wall(items: DocumentSuggestion[]) {
  act(() => {
    root.render(createElement(ReadySignUpScreen, { onSignUp: () => {}, onNotNow: () => {}, moment: wallMomentOf(items) }));
  });
}

describe("the account wall's moment", () => {
  it("shows the most confident moment's clip and the walk's line", () => {
    wall([
      row({ id: "a", start: 0, blockId: "b0", snippetId: "other", snippetAudioRef: "https://media.example/other.webm" }),
      row({ id: "b", start: 50, blockId: "b1", highestMoment: true }),
    ]);
    const moment = host.querySelector("[data-ready-moment]");
    expect(moment).not.toBeNull();
    expect(moment?.querySelector("audio")?.getAttribute("src")).toBe("https://media.example/take.webm");
    expect(moment?.textContent).toContain("This was your most confident moment.");
    expect(host.textContent).toContain("Create an account");
  });

  it("is unchanged when the Take has no praised most confident moment", () => {
    for (const items of [
      [],
      [row({ highestMoment: false })],
      [row({ highestMoment: true, bookmarkTier: "weak" })],
      [row({ highestMoment: true, snippetAudioRef: null })],
    ]) {
      wall(items);
      expect(host.querySelector("[data-ready-moment]")).toBeNull();
      expect(host.textContent).not.toContain("This was your most confident moment.");
      expect(host.textContent).toContain("Create an account");
    }
  });
});
