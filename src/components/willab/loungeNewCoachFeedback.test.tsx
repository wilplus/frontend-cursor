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
import {
  forgetNewCoachFeedback,
  setNewCoachFeedback,
} from "@/lib/willab/newCoachFeedback";
import { type LoungeMessage } from "@/services/api/loungeMessages";

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

describe("the bubble (walk lock flow 1)", () => {

  it("clears when the flag clears", async () => {
    setNewCoachFeedback({ "arc-1": true });
    await draw("arc-1", true);
    expect(tag()).not.toBeNull();
    await act(async () => setNewCoachFeedback({ "arc-1": false }));
    expect(tag()).toBeNull();
    expect(card()).toBeNull();
  });
});
