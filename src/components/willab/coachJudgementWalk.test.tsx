// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The judgement walk, end to end: take 1 → take 2 → the Feedbacks review.    */
/*                                                                            */
/*  FOUNDER, 2026-09-24: "the coach flow doesn't work as intended; after the   */
/*  confident voices are judged and some other moments".                      */
/*                                                                            */
/*  THE DEAD END THESE PIN. `context_unlocked` is the server saying "this      */
/*  coach has now answered every piece" — so it flips on the LAST answer of    */
/*  the queue. The overlay reads it as "leave the blind pass and open the      */
/*  contextual one", and the only control that carries the walk forward        */
/*  ("Judge take 2" / "On to the feedback") lives inside the blind branch.     */
/*  So the coach answers the last piece, the refetch lands, the screen swaps   */
/*  out from under them, and the button they needed is gone. The contextual    */
/*  pass has no forward control of its own; its one exit is the ✕, and in the  */
/*  Lounge that calls `judge.stop()`. Take 2 is never judged and the           */
/*  Feedbacks review never opens.                                             */
/*                                                                            */
/*  SPEC.md puts the contextual pass on a DETOUR — "a take row on the          */
/*  Feedbacks review opens the contextual pass" — never inside the walk. The   */
/*  walk is judgement, take by take, then the feedback. These tests hold the   */
/*  overlay to that.                                                          */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoachReviewOverlay from "./CoachReviewOverlay";
import { useJudgeWalk } from "./useJudgeWalk";
import type { CoachReviewSession } from "@/services/api/coachReview";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div", { "data-testid": "media-player" }),
}));

/** The blind rating lane. It answers before the session read catches up,
 *  which is the whole shape of the bug: the overlay marks the piece answered
 *  locally, then the refetch arrives carrying `contextUnlocked`. */
const saveStateRating = vi.fn(async () => ({
  ok: true as const,
  transcript: "the revealed words",
}));
vi.mock("@/services/api/stateRatings", async (load) => {
  const actual = await load<typeof import("@/services/api/stateRatings")>();
  return { ...actual, saveStateRating: (...a: unknown[]) => saveStateRating(...(a as [])) };
});

const fetchCoachReviewSession = vi.fn();
vi.mock("@/services/api/coachReview", async (load) => {
  const actual = await load<typeof import("@/services/api/coachReview")>();
  return {
    ...actual,
    fetchCoachReviewSession: (id: string) => fetchCoachReviewSession(id),
  };
});

/* ── the two takes of one arc ──────────────────────────────────────────── */

const PIECES: Record<string, string[]> = {
  "take-1": ["s1a", "s1b"],
  "take-2": ["s2a"],
};

/** Who has been answered, as the SERVER sees it — which is what decides
 *  `context_unlocked`. The overlay's own local `judged` map is separate and
 *  deliberately runs ahead of this. */
let answered: Record<string, boolean> = {};

function snippet(id: string) {
  return {
    id,
    index: 0,
    transcript: "",
    audioRef: null,
    startOffsetMs: 0,
    durationMs: 0,
    stickiness: { composite: null, comment: null },
    features: null,
    slide: null,
    aiDraftNote: null,
    autoComment: null,
    recordingKind: "spoken" as const,
    takeSessionId: null,
    bookmarked: false,
    coachState: {
      note: "",
      tag: null,
      direction: null,
      surfaced: false,
      ratingValue: null,
      ratingUnrateable: false,
      videoRef: null,
    },
  };
}

function session(sessionId: string): CoachReviewSession {
  const ids = PIECES[sessionId];
  // THE BACKEND CONTRACT, mirrored exactly: "true only after this coach has
  // committed a blind answer (or an explicit abstention) for every evidence
  // piece" (coachReview.ts). So it flips on the last answer, not later.
  const unlocked = ids.every((id) => answered[id]);
  return {
    sessionId,
    pseudonym: "Coach-facing pseudonym",
    domain: "public_speaking",
    topic: "Series A narrative",
    sentAt: "",
    state: "in_progress",
    overallMessage: "",
    videoRef: null,
    presentationRef: null,
    slides: [],
    snippets: ids.map(snippet),
    feelings: [],
    arcIdealReady: false,
    arcId: "arc-1",
    contextUnlocked: unlocked,
    blindLabel: {
      labelled: ids.filter((id) => answered[id]).length,
      total: ids.length,
      complete: unlocked,
    },
  } as CoachReviewSession;
}

/* ── the harness: the Lounge's own wiring, and nothing else ─────────────── */

const opened: string[] = [];
const completed: { arcId: string; sessionIds: string[] }[] = [];

function Harness() {
  const judge = useJudgeWalk({
    onOpenTake: (id) => {
      opened.push(id);
      setSessionId(id);
    },
    onComplete: (arcId, sessionIds) => {
      completed.push({ arcId, sessionIds });
      setSessionId(null);
    },
  });
  const [sessionId, setSessionId] = useStateShim<string | null>(null);
  // Start the walk once, as the student screen's one door does.
  useOnceShim(() => judge.start("arc-1", ["take-1", "take-2"]));
  if (!sessionId) return null;
  return createElement(CoachReviewOverlay, {
    key: sessionId,
    sessionId,
    onClose: () => {
      judge.stop();
      setSessionId(null);
    },
    completeLabel: judge.completeLabel,
    onQueueComplete: judge.onQueueComplete,
  });
}

// Tiny local shims so the harness reads top-down like the Lounge does.
import { useState as useStateShim, useEffect, useRef } from "react";
function useOnceShim(run: () => void) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    run();
  });
}

/* ── mounting ──────────────────────────────────────────────────────────── */

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  answered = {};
  opened.length = 0;
  completed.length = 0;
  fetchCoachReviewSession.mockReset();
  fetchCoachReviewSession.mockImplementation(async (id: string) => session(id));
  saveStateRating.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});

/** Only what the coach can actually reach.
 *
 *  EVERY piece stays mounted — the queue hides the others with `hidden` so
 *  their drafts survive — so a naive querySelectorAll finds piece 1's chips
 *  from piece 2 and answers the wrong snippet. That is a test that walks a
 *  queue it never advanced. */
function visibleButtons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button")).filter(
    (b) => !b.closest(".hidden"),
  );
}

function labels(): string[] {
  return visibleButtons().map((b) => (b.textContent ?? "").trim());
}

async function click(label: string) {
  const button = visibleButtons().find(
    (b) => (b.textContent ?? "").trim() === label,
  );
  if (!button) throw new Error(`no button labelled "${label}" — saw ${labels().join(" | ")}`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Answer the piece on screen the way a coach does, then let the refetch that
 *  the answer triggers actually land. The landing is the point. */
async function answerCurrent(pieceId: string, choice = "Yes") {
  answered[pieceId] = true;
  await click(choice);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount() {
  await act(async () => {
    root.render(createElement(Harness));
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe("the judgement walk survives the last answer of a take", () => {
  it("take 1's last answer leaves the forward control on screen", async () => {
    await mount();
    expect(container.textContent).toContain("Does the speaker sound confident");

    await answerCurrent("s1a");
    await click("Next");
    await answerCurrent("s1b");

    // THE BUG. `context_unlocked` has just flipped, and with it the whole
    // blind branch — taking the one control that carries the walk forward.
    expect(labels()).toContain("Judge take 2");
  });

  it("walks take 1 → take 2 → the Feedbacks review", async () => {
    await mount();
    await answerCurrent("s1a");
    await click("Next");
    await answerCurrent("s1b");
    await click("Judge take 2");
    await act(async () => {
      await Promise.resolve();
    });

    expect(opened).toEqual(["take-1", "take-2"]);
    await answerCurrent("s2a");
    await click("On to the feedback");
    await act(async () => {
      await Promise.resolve();
    });

    expect(completed).toEqual([
      { arcId: "arc-1", sessionIds: ["take-1", "take-2"] },
    ]);
  });

  it("never drops the walk into the contextual pass", async () => {
    // SPEC.md puts the contextual pass on a detour from the Feedbacks review,
    // never inside the walk. Its tell is the take's own tail page.
    await mount();
    await answerCurrent("s1a");
    await click("Next");
    await answerCurrent("s1b");
    expect(container.textContent).not.toContain("End of this take");
    expect(container.textContent).not.toContain("Re-cut snippets");
  });

  it("a deep-linked single review still opens its contextual pass", async () => {
    // No walk running, so `onQueueComplete` is undefined and the overlay is a
    // single session's review — there the unlock is the way on, and taking it
    // away would be a second bug dressed as a fix.
    await act(async () => {
      root.render(
        createElement(CoachReviewOverlay, {
          sessionId: "take-2",
          onClose: () => {},
        }),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    await answerCurrent("s2a");
    expect(container.textContent).toContain("End of this take");
  });
});
