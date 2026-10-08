// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The Lounge's "new" for fresh coach feedback (build plan D-FW-19; walk lock */
/*  2026-10-06, flow 1; backend 0439):                                         */
/*    - the newest history page carries one yes/no per project, never a count;*/
/*    - with the walk on, the project's latest Ideal Text bubble wears the    */
/*      orange outline and the "new" tag while it is true, and no dot;        */
/*    - an older bubble, or a project with nothing new, is plain;             */
/*    - with the walk off, today's bubble with today's dot, untouched;        */
/*    - the walk says what it showed (the coach's note, a moment), once per   */
/*      opening, and the Lounge reads the flag again after those land.        */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportCard from "./ReportCard";
import { coachShownOn } from "./useDeckFeedbackWalk";
import {
  forgetNewCoachFeedback,
  newCoachFeedbackFor,
  readNewCoachFeedback,
  setNewCoachFeedback,
} from "@/lib/willab/newCoachFeedback";
import { fetchLoungeHistory, refreshNewCoachFeedback, type LoungeMessage } from "@/services/api/loungeMessages";
import { markCoachFeedbackSeen } from "@/services/api/coachFeedbackSeen";
import type { CoachMessage, DocumentSuggestion } from "@/services/api/idealText";
import type { FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
vi.mock("@/services/api/idealText", async (load) => {
  const actual = await load<typeof import("@/services/api/idealText")>();
  return {
    ...actual,
    primeIdealTextDisplay: vi.fn(),
    fetchIdealTextCore: vi.fn(async () => ({
      kind: "single",
      title: "Q3 Board pitch",
      status: null,
      version: 2,
      // One coach moment not opened: today's dot would show "1".
      confidentMomentSummary: { items: [{ hasUnreadCoachUpdate: true }] },
    })),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  forgetNewCoachFeedback();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const bubble = (arcId: string): LoungeMessage => ({
  client_id: `m-${arcId}`,
  role: "bot",
  kind: "ideal_text",
  body: "",
  metadata: { arc_id: arcId, version: 2, topic: "Q3 Board pitch" },
  client_created_at: "2026-10-08T09:00:00Z",
});

async function draw(arcId: string, latest: boolean) {
  await act(async () => {
    root.render(createElement(ReportCard, {
      message: bubble(arcId),
      latestForArc: latest,
      onOpenIdealText: vi.fn(),
    }));
  });
  await act(async () => {
    await Promise.resolve();
  });
}

const tag = () => container.querySelector('[data-testid="new-coach-feedback-tag"]');
const card = () => container.querySelector<HTMLElement>("[data-marked]");
const dot = () => container.querySelector('[data-testid="unread-feedback-dot"]');

describe("the flag, as served", () => {
  it("reads one yes/no per project; anything else is no flag", () => {
    expect(readNewCoachFeedback({ "arc-1": true, "arc-2": false, "arc-3": 2 })).toEqual({
      "arc-1": true,
      "arc-2": false,
      "arc-3": false,
    });
    expect(readNewCoachFeedback(null)).toBeNull();
    expect(readNewCoachFeedback([true])).toBeNull();
    setNewCoachFeedback({ "arc-1": true });
    expect(newCoachFeedbackFor("arc-1")).toBe(true);
    expect(newCoachFeedbackFor("arc-2")).toBe(false);
    expect(newCoachFeedbackFor(null)).toBe(false);
  });

  it("the newest history page sets it; an older page leaves it", async () => {
    const page = (flags: unknown) => ({
      ok: true,
      json: async () => ({ messages: [], has_more: false, oldest_cursor: null, new_coach_feedback: flags }),
    });
    const fetchMock = vi.fn(async () => page({ "arc-1": true }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchLoungeHistory();
    expect(newCoachFeedbackFor("arc-1")).toBe(true);
    fetchMock.mockImplementation(async () => page({ "arc-1": false }));
    await fetchLoungeHistory({ before: "2026-10-08T00:00:00Z" });
    expect(newCoachFeedbackFor("arc-1")).toBe(true);
    // A page without it (an older backend) keeps what is known.
    fetchMock.mockImplementation(async () => page(undefined));
    await fetchLoungeHistory();
    expect(newCoachFeedbackFor("arc-1")).toBe(true);
  });

  it("is read again only after the walk's shows have landed", async () => {
    const order: string[] = [];
    let land: () => void = () => undefined;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("coach-feedback/seen")) {
        order.push("seen sent");
        await new Promise<void>((resolve) => { land = resolve; });
        order.push("seen landed");
        return { ok: true, json: async () => ({ seen: true }) };
      }
      order.push(`read ${url.includes("limit=1") ? "limit=1" : url}`);
      return { ok: true, json: async () => ({ messages: [], has_more: false, oldest_cursor: null, new_coach_feedback: { "arc-1": false } }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    setNewCoachFeedback({ "arc-1": true });
    const seen = markCoachFeedbackSeen({ takeSessionId: "take-1" });
    const refresh = refreshNewCoachFeedback();
    await act(async () => { await Promise.resolve(); });
    land();
    await seen;
    await refresh;
    expect(order).toEqual(["seen sent", "seen landed", "read limit=1"]);
    expect(newCoachFeedbackFor("arc-1")).toBe(false);
  });

  it("says what was shown: the Take for the coach's note, the snippet for a moment", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ seen: true }) }));
    vi.stubGlobal("fetch", fetchMock);
    await markCoachFeedbackSeen({ takeSessionId: "take-1" });
    await markCoachFeedbackSeen({ takeSessionId: "take-1", snippetId: "snip-1" });
    expect(fetchMock.mock.calls.map(([url, init]) => [url, JSON.parse(String(init?.body))])).toEqual([
      ["/api/v2/user/coach-feedback/seen", { take_session_id: "take-1" }],
      ["/api/v2/user/coach-feedback/seen", { take_session_id: "take-1", snippet_id: "snip-1" }],
    ]);
  });
});

describe("the bubble (walk lock flow 1)", () => {
  it("walk on, latest bubble, new coach feedback: the orange outline and the \"new\" tag, no dot", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_WALK", "on");
    setNewCoachFeedback({ "arc-1": true });
    await draw("arc-1", true);
    expect(card()!.className).toMatch(/outline-2/);
    expect(card()!.className).toMatch(/outline-primary/);
    expect(card()!.className).toMatch(/outline-offset-\[3px\]/);
    expect(tag()!.textContent).toBe("new");
    expect(tag()!.className).toMatch(/bg-primary/);
    expect(tag()!.className).toMatch(/text-white/);
    expect(dot()).toBeNull();
    // No number anywhere on the mark (AC-9).
    expect(tag()!.textContent).not.toMatch(/\d/);
  });

  it("clears when the flag clears", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_WALK", "on");
    setNewCoachFeedback({ "arc-1": true });
    await draw("arc-1", true);
    expect(tag()).not.toBeNull();
    await act(async () => setNewCoachFeedback({ "arc-1": false }));
    expect(tag()).toBeNull();
    expect(card()).toBeNull();
  });

  it("an older bubble of the project, or another project, stays plain", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_WALK", "on");
    setNewCoachFeedback({ "arc-1": true });
    await draw("arc-1", false);
    expect(tag()).toBeNull();
    await draw("arc-2", true);
    expect(tag()).toBeNull();
    expect(dot()).toBeNull();
  });

  it("walk off: today's bubble and today's dot, no outline", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_WALK", "off");
    setNewCoachFeedback({ "arc-1": true });
    await draw("arc-1", true);
    expect(tag()).toBeNull();
    expect(card()).toBeNull();
    expect(dot()?.textContent).toBe("1");
  });
});

describe("what a walk screen showed of the coach's work", () => {
  const item = (id: string, snippetId: string | null, takeSessionId: string | null = "take-2") =>
    ({ id, snippetId, takeSessionId }) as unknown as DocumentSuggestion;
  const coach = { text: "Lovely.", videoUrl: null, takeIndex: 2, publishedAt: null, takeSessionId: "take-2" } as CoachMessage;
  const moment = (over: Partial<FeedbackWalkMoment<DocumentSuggestion>>) =>
    ({ index: 0, clearer: null, exercise: null, practiseItem: null, judgeItem: null, ...over }) as FeedbackWalkMoment<DocumentSuggestion>;

  it("the coach's note: its Take", () => {
    expect(coachShownOn({ key: "coachnote" }, null, coach)).toEqual([{ takeSessionId: "take-2" }]);
    expect(coachShownOn({ key: "coachnote" }, null, { ...coach, takeSessionId: null })).toEqual([]);
  });

  it("a moment: each of its snippets once, from its items and what is open on its paragraphs", () => {
    const shown = coachShownOn(
      { key: "praise", moment: 0 },
      moment({ judgeItem: item("cv", "snip-1"), practiseItem: item("rw", "snip-1"), exercise: { video: null, instruction: null, say: "x", item: item("ex", "snip-2") } }),
      coach,
      [item("open", "snip-3"), item("nosnip", null), item("notake", "snip-4", null)],
    );
    expect(shown).toEqual([
      { takeSessionId: "take-2", snippetId: "snip-1" },
      { takeSessionId: "take-2", snippetId: "snip-2" },
      { takeSessionId: "take-2", snippetId: "snip-3" },
    ]);
  });

  it("a screen of no moment says nothing", () => {
    expect(coachShownOn({ key: "intro" }, null, coach)).toEqual([]);
  });
});
