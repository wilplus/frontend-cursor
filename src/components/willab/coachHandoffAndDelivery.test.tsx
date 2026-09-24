// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THREE FOUNDER RULINGS, 2026-09-24.                                         */
/*                                                                            */
/*  (1) THE ✕ LEAVES. On "Review and send" it used to step back a screen,      */
/*      which made one glyph do two jobs — every other Shell in the delivery   */
/*      flow closes the overlay.                                              */
/*                                                                            */
/*  (2) THE TAKE-LEVEL COACH VIDEO IS RETIRED (superseded the same day:        */
/*      "I only want to exercise videos, not the coach video at the end").     */
/*      It briefly gained a server seed so the checklist could see a video     */
/*      recorded in an earlier sitting; the founder then removed the feature   */
/*      instead, so what is pinned here is its ABSENCE. An exercise's own      */
/*      demonstration video is untouched and is the one that reaches the       */
/*      speaker.                                                              */
/*                                                                            */
/*  (3) THE CMS DEEP LINK SURVIVES THE PASSWORD GATE. /cms/new/exercise/1 is   */
/*      already the record step, but the gate bounced to /cms and dropped the  */
/*      lane, the step and the returnTo — so "build an exercise for this       */
/*      moment" landed the coach on the Post-or-Exercise fork instead.        */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { interruptedDestination } from "@/app/cms/interruptedDestination";

// process.cwd(), not import.meta.url: this file runs in jsdom, where
// import.meta.url is not a file: URL and fileURLToPath throws.
const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/* ── the delivery overlay, mounted for real ────────────────────────────── */

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div"),
}));

const fetchCoachReviewState = vi.fn();
vi.mock("@/services/api/coachReviewState", async (load) => {
  const actual = await load<typeof import("@/services/api/coachReviewState")>();
  return { ...actual, fetchCoachReviewState: (id: string) => fetchCoachReviewState(id) };
});

// The message screen will not advance until its save succeeds.
vi.mock("@/services/api/saveCoachFeedback", () => ({
  saveCoachFeedback: vi.fn(async () => ({ ok: true as const })),
}));

import CoachDeliveryOverlay from "./CoachDeliveryOverlay";

const STATE = {
  arcId: "arc-1",
  published: false,
  takes: [
    { sessionId: "take-1", takeIndex: 1, reviewState: null, hasReread: false,
      publishPayload: { sessionId: "take-1", overallMessage: "", feedbackItems: [], shareVideo: false } },
  ],
  takesSaved: 1, takesTotal: 1, takesTarget: 3,
  ideal: { assemblyState: "ready", ready: true, approved: true, source: "machine", takesDone: 3 },
  canPublish: true, blockers: [], advisories: [], pendingSessionIds: [],
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  fetchCoachReviewState.mockReset().mockResolvedValue(STATE);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function mount(onClose = () => {}) {
  await act(async () => {
    root.render(
      createElement(CoachDeliveryOverlay, {
        arcId: "arc-1",
        onOpenArcIdeal: () => {},
        onPublished: () => {},
        onClose,
      }),
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const buttons = () => Array.from(container.querySelectorAll("button"));
async function click(match: (b: HTMLButtonElement) => boolean) {
  const b = buttons().find(match);
  if (!b) throw new Error(`no such button — saw ${buttons().map((x) => x.textContent?.trim() || x.getAttribute("aria-label")).join(" | ")}`);
  await act(async () => {
    b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await Promise.resolve();
  });
}
const byText = (t: string) => (b: HTMLButtonElement) => (b.textContent ?? "").trim().startsWith(t);

describe("the take-level coach video is gone", () => {
  it("the message screen offers no video slot", async () => {
    await mount();
    await click(byText("Ideal text · approved"));
    // On the message screen now: a message box and one way forward.
    expect(container.textContent).toContain("Message to the user");
    expect(container.textContent).not.toContain("Coach video");
  });

  it("the final checklist does not promise one", async () => {
    // It used to carry a "Coach video · None/Recorded" row. A row for a
    // surface that no longer exists would be the worst of both.
    await mount();
    await click(byText("Ideal text · approved"));
    await click(byText("Review and send"));
    expect(container.textContent).toContain("Ideal text");
    expect(container.textContent).not.toContain("Coach video");
  });

  it("the exercise video path is untouched", () => {
    // The one video that does reach the speaker. It uploads through the same
    // transport the retired slot used, so deleting the slot must not take the
    // uploader with it.
    const practice = read(join("components", "willab", "CoachConfidencePracticeReview.tsx"));
    expect(practice).toContain("uploadCoachVideo");
    expect(practice).toContain("Exercise video");
  });
});

describe("the ✕ on the last screen leaves", () => {
  it("closes the overlay instead of stepping back", async () => {
    const onClose = vi.fn();
    await mount(onClose);
    await click(byText("Ideal text · approved"));
    await click(byText("Review and send"));
    expect(container.textContent).toContain("Review and send");

    const x = buttons().find((b) => (b.getAttribute("aria-label") ?? "").toLowerCase().includes("close"));
    expect(x).toBeTruthy();
    await act(async () => {
      x!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("the CMS deep link survives the password gate", () => {
  const AT = (search: string) => {
    window.history.replaceState({}, "", `/cms${search}`);
  };

  it("resumes an authoring destination", () => {
    AT("?next=%2Fcms%2Fnew%2Fexercise%2F1%3FreturnTo%3D%252Fchat%253Freview%253Dtake-1");
    // One decode, so the inner returnTo stays encoded and keeps its own &.
    expect(interruptedDestination()).toBe(
      "/cms/new/exercise/1?returnTo=%2Fchat%3Freview%3Dtake-1",
    );
  });

  it("refuses anything that is not an authoring path", () => {
    // The value arrives in a query parameter, so it is attacker-supplied by
    // construction; an open redirect out of the CMS is the failure to avoid.
    for (const bad of [
      "https://evil.example/cms/new/",
      "//evil.example/cms/new/",
      "/chat?review=x",
      "/cms",
      "/cms/newish/exercise/1",
      "",
    ]) {
      AT(`?next=${encodeURIComponent(bad)}`);
      expect(interruptedDestination()).toBeNull();
    }
  });

  it("is null when nothing was interrupted", () => {
    AT("");
    expect(interruptedDestination()).toBeNull();
  });

  it("the bounce carries the destination rather than dropping it", () => {
    const gate = read(join("app", "cms", "new", "page.client.tsx"));
    // A bare router.replace("/cms") is the bug: it loses the lane, the step
    // and the returnTo in one line.
    expect(gate).not.toContain('router.replace("/cms")');
    expect(gate).toContain("/cms?next=");
  });

  it("step 1 of the exercise lane is still the record screen", () => {
    // The whole hand-off rests on this: if a screen were ever inserted before
    // `record`, the deep link would quietly point at the wrong one again.
    const lanes = read(join("app", "cms", "new", "laneDraft.ts"));
    const first = lanes.indexOf("export const EXERCISE_STEPS");
    expect(lanes.slice(first, first + 200)).toContain('id: "record"');

    const review = read(join("components", "willab", "CoachReviewOverlay.tsx"));
    expect(review).toContain("/cms/new/exercise/1?returnTo=");
  });
});
