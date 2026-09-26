// @vitest-environment jsdom
/* Back / Next across the bookmarks, where the email and the chat bubble
   land, and the one chat bubble (founder 2026-09-25, Q28 A–Q36 A). */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBookmarks,
  FeedbackPagerBar,
  landingIndex,
  useFeedbackPager,
  type Bookmark,
} from "./feedbackPager";
import { UnreadDot, unreadCoachFeedback } from "./ReportCard";
import { latestIdealBubbleIds } from "./unreadFeedback";
import { isRetiredLoungeMessage } from "./willabHelpers";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import { momentsLine } from "../../../emails/PostSessionResultsEmail";
import { buildPostSessionResultsText } from "../../../emails/postSessionResultsText";

const chunk = (id: string): DeckChunk =>
  ({ part: { id, text: `words ${id}` }, paragraphIndex: 0 }) as unknown as DeckChunk;

const FEEDBACK: Record<string, { pending: number; decided: number }> = {
  a: { pending: 1, decided: 0 },
  b: { pending: 0, decided: 0 },
  c: { pending: 0, decided: 2 },
  d: { pending: 0, decided: 0 },
};
const MARKERS: Record<string, { bundleId: string; hasCoachUpdate: boolean }[]> = {
  d: [{ bundleId: "bundle-d", hasCoachUpdate: true }],
};

function bookmarks(): Bookmark[] {
  return buildBookmarks(
    [chunk("a"), chunk("a"), chunk("b"), chunk("c"), chunk("d")],
    (c) => FEEDBACK[c.part.id],
    (id) => MARKERS[id],
  );
}

describe("the bookmarks", () => {
  it("are every paragraph with feedback, open or done, once each, in text order", () => {
    const list = bookmarks();
    expect(list.map((b) => b.partId)).toEqual(["a", "c", "d"]);
    expect(list[2]).toMatchObject({ bundleId: "bundle-d", coach: true });
  });

  it("the link lands on the first coach-reviewed one, never a judgement-only one", () => {
    expect(landingIndex(bookmarks())).toBe(2);
    const noCoach = buildBookmarks([chunk("a")], (c) => FEEDBACK[c.part.id], () => undefined);
    expect(landingIndex(noCoach)).toBe(-1);
  });
});

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const buttons = () =>
  Array.from(container.querySelectorAll("button")).map((b) => ({
    label: (b.textContent ?? "").trim(),
    disabled: b.disabled,
    el: b,
  }));

describe("the bar, copied from the coach panel", () => {
  it("Back is off on the first; Next is always Next, and Done on the last", async () => {
    await act(async () =>
      root.render(createElement(FeedbackPagerBar, {
        pager: { index: 0, total: 3, onBack: vi.fn(), onNext: vi.fn() },
      })),
    );
    expect(buttons()).toMatchObject([
      { label: "Back", disabled: true },
      { label: "Next", disabled: false },
    ]);
    await act(async () =>
      root.render(createElement(FeedbackPagerBar, {
        pager: { index: 2, total: 3, onBack: vi.fn(), onNext: vi.fn() },
      })),
    );
    expect(buttons().map((b) => b.label)).toEqual(["Back", "Done"]);
    expect(buttons().some((b) => b.label === "Skip")).toBe(false);
  });
});

function Harness({
  onOpen,
  onCloseAll,
  openFeedback,
}: {
  onOpen: (b: Bookmark) => void;
  onCloseAll: () => void;
  openFeedback: boolean;
}) {
  const [list] = useState(bookmarks);
  const walk = useFeedbackPager({
    bookmarks: list,
    open: onOpen,
    closeAll: onCloseAll,
    openFeedback,
    ready: true,
  });
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "at" }, String(walk.pager?.index ?? "none")),
    createElement(FeedbackPagerBar, { pager: walk.pager }),
    createElement("button", { onClick: () => walk.openPart("a") }, "open-a"),
  );
}

describe("the walk", () => {
  it("lands on the coach's moment once, then Back and Next move through every bookmark", async () => {
    const opened: string[] = [];
    const closeAll = vi.fn();
    await act(async () =>
      root.render(createElement(Harness, {
        onOpen: (b: Bookmark) => opened.push(b.partId),
        onCloseAll: closeAll,
        openFeedback: true,
      })),
    );
    expect(opened).toEqual(["d"]);
    const click = async (label: string) => {
      const b = buttons().find((x) => x.label === label)!;
      await act(async () => b.el.click());
    };
    await click("Back");
    expect(opened.at(-1)).toBe("c");
    await click("Next");
    expect(opened.at(-1)).toBe("d");
    await click("Done");
    expect(closeAll).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="at"]')?.textContent).toBe("none");
    // A tap on a paragraph joins the walk at that bookmark.
    await click("open-a");
    expect(opened.at(-1)).toBe("a");
    expect(container.querySelector('[data-testid="at"]')?.textContent).toBe("0");
  });

  it("does not open anything by itself without the link", async () => {
    const opened: string[] = [];
    await act(async () =>
      root.render(createElement(Harness, {
        onOpen: (b: Bookmark) => opened.push(b.partId),
        onCloseAll: vi.fn(),
        openFeedback: false,
      })),
    );
    expect(opened).toEqual([]);
  });
});

describe("the unread-feedback dot (Q39 B, Q40 B, Q42 A)", () => {
  it("the feedback bubble is deleted: old rows stay hidden", () => {
    expect(isRetiredLoungeMessage({
      client_id: "m1", role: "bot", kind: "ideal_text", body: "b",
      metadata: { variant: "coach_feedback_published", arc_id: "arc-1" },
      client_created_at: "t",
    } as never)).toBe(true);
  });

  it("counts coach moments whose feedback is not opened yet", () => {
    expect(unreadCoachFeedback(null)).toBe(0);
    expect(unreadCoachFeedback({ items: [
      { hasUnreadCoachUpdate: true },
      { hasUnreadCoachUpdate: false },
      { hasUnreadCoachUpdate: true },
    ] })).toBe(2);
  });

  it("shows a white number on the dot, and nothing at zero", async () => {
    await act(async () => root.render(createElement(UnreadDot, { count: 3 })));
    const dot = container.querySelector('[data-testid="unread-feedback-dot"]');
    expect(dot?.textContent).toBe("3");
    expect(dot?.className).toContain("bg-primary");
    expect(dot?.className).toContain("text-white");
    expect(dot?.className).toContain("-right-2 -top-2");
    await act(async () => root.render(createElement(UnreadDot, { count: 0 })));
    expect(container.querySelector('[data-testid="unread-feedback-dot"]')).toBeNull();
  });

  it("sits only on each project's latest version bubble", () => {
    const msg = (id: string, arc: string, variant: string) => ({
      kind: "message",
      message: { client_id: id, kind: "ideal_text", metadata: { arc_id: arc, variant } },
    }) as never;
    const ids = latestIdealBubbleIds([
      msg("a1", "arc-a", "ready"),
      msg("b1", "arc-b", "ready"),
      msg("a2", "arc-a", "verified"),
      msg("a3", "arc-a", "instant"),
      msg("b2", "arc-b", "coach_feedback_published"),
    ]);
    expect([...ids].sort()).toEqual(["a2", "b1"]);
  });
});

describe("the email's words (signed off 2026-09-25)", () => {
  it("counts moments, never scores", () => {
    expect(momentsLine(1)).toBe(
      "Your coach listened to your latest take and left feedback on 1 moment.");
    expect(momentsLine(4)).toContain("on 4 moments.");
    expect(momentsLine(0)).toBe(
      "Your coach listened to your latest take and left feedback.");
  });

  it("the plain-text part says the same thing, with one link", () => {
    const text = buildPostSessionResultsText({
      snippetCount: 2,
      topTheme: "Series A pitch",
      journeyUrl: "https://www.willpowerlab.com/chat?idealArc=a&feedback=1",
      unsubscribeUrl: "https://www.willpowerlab.com/unsubscribe?token=t",
      subscribedEmail: "a@b.c",
    });
    expect(text).toContain("SERIES A PITCH");
    expect(text).toContain("Your coach's feedback is in.");
    expect(text).toContain("Open the feedback:");
    expect(text).not.toMatch(/Published snippets|contextual chat|Hi there/);
  });
});
