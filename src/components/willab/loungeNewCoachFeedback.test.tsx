// @vitest-environment jsdom
/*
STORY    As a speaker, I want my project's latest Ideal Text bubble in the
         Lounge to say "new" when coach feedback is waiting, never as a count,
         so that I know to look without seeing a number.
OUTCOME
  O1  While the project's flag is true, its latest bubble gets a second,
      outlined bubble with the mark, and a tap on it opens the feedback.
  O2  Never 1 (no numbers shown to speakers): the mark is a plain dot; the
      marked bubble shows the same words as the plain one and no count, even
      when a coach moment is unread.
  O3  An older bubble of the project, or a project with nothing new, is plain.
  O4  The mark clears when the flag clears.
PROVES   O1, O2 -> "the latest bubble wears the mark, with no count"
         O3     -> "an older bubble, or a project with nothing new, is plain"
         O4     -> "clears when the flag clears"
WHY      Build plan D-FW-19; walk lock 2026-10-06, flow 1; backend 0439.
*/
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
      // One coach moment not opened: a count would read "1".
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

const onOpenIdealText = vi.fn();

async function draw(arcId: string, latest: boolean) {
  onOpenIdealText.mockClear();
  await act(async () => {
    root.render(createElement(ReportCard, {
      message: bubble(arcId),
      latestForArc: latest,
      onOpenIdealText,
    }));
  });
  await act(async () => {
    await Promise.resolve();
  });
}

// The coach's feedback is its own outlined bubble with the "new" dot
// (founder 2026-10-14, walk first).
const dot = () => container.querySelector('[data-testid="new-coach-feedback-dot"]');
const plainCard = () => container.querySelector("[data-review-card]") as HTMLButtonElement | null;
const coachCard = () => container.querySelector("[data-coach-feedback-card]") as HTMLButtonElement | null;

describe("the bubble (walk lock flow 1)", () => {

  it("the latest bubble wears the mark, with no count", async () => {
    setNewCoachFeedback({ "arc-1": true });
    await draw("arc-1", true);
    // The project's name and the Take's own version tag, nothing else.
    expect(plainCard()?.textContent).toBe("Q3 Board pitch2.0›");
    expect(coachCard()).not.toBeNull();
    expect(dot()).not.toBeNull();
    // The mark adds no words and no number: the same card, plus a bare dot.
    expect(dot()?.textContent).toBe("");
    expect(coachCard()?.textContent).toBe(plainCard()?.textContent);
    await act(async () => coachCard()!.click());
    expect(onOpenIdealText).toHaveBeenCalledWith("arc-1", "feedback");
  });

  it("an older bubble, or a project with nothing new, is plain", async () => {
    setNewCoachFeedback({ "arc-1": true, "arc-2": false });
    await draw("arc-1", false);
    expect(plainCard()?.textContent).toContain("Q3 Board pitch");
    expect(coachCard()).toBeNull();
    expect(dot()).toBeNull();
    await draw("arc-2", true);
    expect(plainCard()?.textContent).toContain("Q3 Board pitch");
    expect(coachCard()).toBeNull();
    expect(dot()).toBeNull();
  });

  it("clears when the flag clears", async () => {
    setNewCoachFeedback({ "arc-1": true });
    await draw("arc-1", true);
    expect(dot()).not.toBeNull();
    await act(async () => setNewCoachFeedback({ "arc-1": false }));
    expect(dot()).toBeNull();
  });
});
