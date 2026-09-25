// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE STORY BEHIND ANY MOMENT (founder 2026-09-25).                          */
/*                                                                            */
/*  "the album shows your confident moments, not any moments." The Album only  */
/*  admits a clip on three separate yeses, so the history above it can only    */
/*  ever be told about a moment that went well — and the ones worth learning   */
/*  from are the others.                                                      */
/*                                                                            */
/*  Two properties matter here. It must not read anything until the speaker    */
/*  asks (they came to practise, not to be charged for a fetch they did not    */
/*  want), and it must never invent a chapter it could not load.               */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MomentHistory } from "@/services/api/voiceAlbum";

const { fetchSnippetHistory } = vi.hoisted(() => ({
  fetchSnippetHistory: vi.fn(
    async (): Promise<MomentHistory | null> => null,
  ),
}));
vi.mock("@/services/api/voiceAlbum", async () => {
  const actual =
    await vi.importActual<typeof import("@/services/api/voiceAlbum")>(
      "@/services/api/voiceAlbum",
    );
  return { ...actual, fetchSnippetHistory };
});

import MomentStory from "./MomentStory";

const HISTORY: MomentHistory = {
  momentKey: "snip-1",
  origin: { takeIndex: 2, slideIndex: 3, at: null, source: "snippet" },
  events: [
    {
      kind: "owner_answer",
      who: "You",
      at: "2026-09-01T10:00:00Z",
      response: "no",
    },
  ],
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  fetchSnippetHistory.mockReset();
  fetchSnippetHistory.mockResolvedValue(null);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(props: Partial<Parameters<typeof MomentStory>[0]> = {}) {
  act(() =>
    root.render(
      <MomentStory
        arcId="arc-1"
        sessionId="sess-1"
        snippetId="snip-1"
        {...props}
      />,
    ),
  );
}
function toggle() {
  const button = host.querySelector("button");
  if (!button) throw new Error("no toggle");
  act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

describe("the story behind a moment", () => {
  it("reads nothing until the speaker asks for it", () => {
    render();
    expect(fetchSnippetHistory).not.toHaveBeenCalled();
    expect(host.textContent).toContain("History");
  });

  it("loads on open, and asks about this exact moment", async () => {
    fetchSnippetHistory.mockResolvedValue(HISTORY);
    render();
    await act(async () => {
      toggle();
    });
    expect(fetchSnippetHistory).toHaveBeenCalledWith(
      "arc-1",
      "sess-1",
      "snip-1",
    );
    expect(host.textContent).toContain("Take 2");
    expect(host.textContent).toContain("Hide");
  });

  it("says so plainly when it cannot load, instead of showing an empty story", async () => {
    fetchSnippetHistory.mockResolvedValue(null);
    render();
    await act(async () => {
      toggle();
    });
    // Straight apostrophe on purpose: this is the Album's shipped string,
    // reused verbatim. Matching it loosely would let the copy drift.
    expect(host.textContent).toContain("couldn't load this history just now.");
  });

  it("draws nothing at all without a moment to ask about", () => {
    render({ snippetId: null });
    expect(host.querySelector("button")).toBeNull();
    render({ sessionId: null });
    expect(host.querySelector("button")).toBeNull();
  });

  it("does not read twice for one opening", async () => {
    fetchSnippetHistory.mockResolvedValue(HISTORY);
    render();
    await act(async () => {
      toggle();
    });
    await act(async () => {
      toggle();
    });
    await act(async () => {
      toggle();
    });
    expect(fetchSnippetHistory).toHaveBeenCalledOnce();
  });
});
