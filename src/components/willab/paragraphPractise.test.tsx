// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  ONE PRACTISE EVERYWHERE (founder 2026-10-10, "the practise screens should  */
/*  be the same in all cases and recording a practise too").                  */
/*                                                                            */
/*  Practise on a paragraph's own sheet opens the Feedback walk's practise    */
/*  screens (practisePart), on the card the sheet shows: a clearer version's  */
/*  words, an exercise's passage under its instruction, or the moment said    */
/*  again. A card with nothing to open a practice on (no snippet and no       */
/*  evidence) cannot open, and the sheet shows no Practise for it.            */
/* -------------------------------------------------------------------------- */
import { act, createElement, type MutableRefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeckFeedbackWalk } from "./useDeckFeedbackWalk";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import type { PractiseCard } from "@/lib/willab/paragraphOverlay";
import type { DocumentSuggestion } from "@/services/api/idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/services/api/consentChoices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/consentChoices")>()),
  practiseOfferedNow: () => true,
  readPractiseOffered: async () => true,
}));
const mic = vi.hoisted(() => ({ starts: 0, cancels: 0 }));
vi.mock("@/hooks/useDualCaptureMic", () => ({
  useDualCaptureMic: () => ({
    state: { status: "idle" },
    start: async () => {
      mic.starts += 1;
    },
    stop: async () => undefined,
    cancel: () => {
      mic.cancels += 1;
    },
    getAudioStartedAt: () => null,
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT = "Three things stood out: retention went up, churn went down.";
const EVIDENCE = { projectId: "arc-1", takeSessionId: "take-2", slideIndex: 0, paragraphIndex: 0, start: 24, end: 41 };
/** The paragraph's Confident Voice moment: its clip, its snippet. */
const moment = {
  id: "s-cv", start: 24, end: 41, quote: "retention went up", kind: "advice",
  feedbackFamily: "confident_voice", source: "confident_voice", snippetId: "snip-1",
  takeSessionId: "take-2", evidence: EVIDENCE, snippetAudioRef: "https://media/moment.wav",
  startOffsetMs: 0, durationMs: 9000,
} as unknown as DocumentSuggestion;
/** A served rewrite on the same moment, with no snippet of its own: it is
 *  practised on the moment's snippet. */
const rewriteItem = {
  id: "s-rw", start: 24, end: 41, quote: "retention went up", kind: "replace",
  proposedText: "retention rose", feedbackFamily: "rewrite_clarity", takeSessionId: "take-2",
} as unknown as DocumentSuggestion;

const rewriteCard: PractiseCard = { kind: "rewrite", item: rewriteItem, text: "retention rose", move: "Say it plainly." };
const plainCard: PractiseCard = { kind: "plain", item: moment, text: "retention went up", coach: false };

/* ---- practisePart, on the deck's own hook ---------------------------------- */

type Walk = ReturnType<typeof useDeckFeedbackWalk>;

const chunk = { part: { id: "p1", text: TEXT } } as unknown as DeckChunk;
const onEnd = vi.fn();

function Harness({ api }: { api: MutableRefObject<Walk | null> }) {
  const walk = useDeckFeedbackWalk({
    chunks: [chunk],
    groups: [{ slideIndex: 0, chunks: [chunk] }],
    waiting: () => false,
    pendingOf: () => [],
    slideLabel: () => "Slide 1",
    coachMessage: null,
    coachSeen: () => undefined,
    firstTake: false,
    takeSessionId: "take-2",
    setRootPhrase: vi.fn(async () => true),
    onAccept: vi.fn(async () => true),
    onKeepMine: vi.fn(async () => true),
    lockPart: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
    saveBehind: vi.fn(),
    onEnd,
  });
  api.current = walk;
  return walk.element as never;
}

let root: Root;
let container: HTMLDivElement;
const api: MutableRefObject<Walk | null> = { current: null };
const live = () => document.querySelector<HTMLElement>("[data-feedback-walk] .walk-layer:not(.walk-ghost)");
const screen = () => live()?.querySelector<HTMLElement>("[data-testid^='walk-screen-']")?.dataset.testid ?? null;
const practiseCalls = () =>
  vi.mocked(fetch).mock.calls.map(([url]) => String(url)).filter((url) => url.includes("confidence-practice"));

beforeEach(async () => {
  mic.starts = 0;
  mic.cancels = 0;
  onEnd.mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(Harness, { api })));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("practisePart", () => {
  it("opens the walk's practise for the paragraph: recording at once, on the moment's snippet", async () => {
    let opened = false;
    await act(async () => {
      opened = api.current!.practisePart("p1", rewriteCard, moment);
    });
    await act(async () => undefined);
    expect(opened).toBe(true);
    expect(screen()).toBe("walk-screen-practise");
    expect(live()!.querySelector("[data-walk-say]")!.textContent).toBe("retention rose");
    expect(mic.starts).toBe(1);
    expect(practiseCalls()).toEqual(["/api/v2/user/snippets/snip-1/confidence-practice"]);
    // ✕ ends it on the page: the mic off, and no end card for the walk.
    await act(async () => live()!.querySelector<HTMLButtonElement>("button[aria-label='Close']")!.click());
    expect(mic.cancels).toBeGreaterThan(0);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("a paragraph without a practisable item opens nothing", async () => {
    const bare = { ...moment, snippetId: null, evidence: null } as unknown as DocumentSuggestion;
    let opened = true;
    await act(async () => {
      opened = api.current!.practisePart("p1", { ...plainCard, item: bare }, bare);
    });
    expect(opened).toBe(false);
    expect(screen()).toBeNull();
    expect(mic.starts).toBe(0);
    // Nor does a paragraph the page does not hold.
    await act(async () => {
      opened = api.current!.practisePart("p-missing", plainCard, moment);
    });
    expect(opened).toBe(false);
  });
});
