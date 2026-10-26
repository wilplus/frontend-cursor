// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want my coach's unseen word reachable through
 *          "Review feedback" even when every moment is answered, and a
 *          paragraph whose helper words I deleted to rejoin the walk, so that
 *          I never miss my coach or a paragraph.
 * OUTCOME
 *   O1  Every moment answered and an unseen coach word: Review feedback
 *       stays, opens Step 0 only on its tap, and goes once watched: only
 *       Continue clears it, ✕ keeps it, and a changed word (a new video)
 *       brings it back (N80 D4, D7; backend N77).
 *   O2  After Delete the paragraph rejoins the walk on its earlier answer,
 *       at once, not only when a moment is open on it (N48.2 Q6 A).
 *   O3  Every moment answered: a bubble of the Take tapped in the Lounge
 *       opens the walk as given on that moment, with the parts before and
 *       after it there to scroll, never the Ideal Text in its place
 *       (founder 2026-10-21, N90), the coach's word seen or not.
 *   O4  One moment answered, one still waiting: the waiting one's bubble
 *       opens the whole Take's walk, the answered praise above to scroll
 *       and the Exercise live with its own buttons, under the number the
 *       Take's walk gave it, so the chat gets no new bubble (founder
 *       2026-10-21: "doesn't open the walk in a scrollable manner", "appears
 *       as a last message in the chat").
 *   O5  Every moment answered: the chat's Feedback walk naming a step the
 *       finished walk does not hold (its summary, or the Take alone) opens
 *       the whole walk on its newest step, never the Ideal Text in its place
 *       (founder 2026-10-26: "the feedback walk opens the ideal text instead
 *       of the feedback walk!"; B10, N192).
 * PROVES   O1 -> "every moment answered: Review feedback stays for the unseen word, ..."
 *          O2 -> "a paragraph whose helper words were deleted is back in the walk on its earlier answer"
 *          O3 -> "every moment answered: a bubble tapped in the Lounge opens the walk on its moment, never the text"
 *          O4 -> "one moment still waiting: its bubble opens the whole walk, the waiting step live, nothing new in the chat"
 *          O5 -> "every moment answered: the Feedback walk naming no step of the walk opens it on its newest step, never the text"
 * WHY      Wave 2 of Closing the Gap (founder 2026-10-05). O2 is checked at the
 *          deck's own rule (buildBookmarks), not on the rendered deck.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import { buildBookmarks, helperWordsDeleted } from "./feedbackPager";
import type { Part } from "@/lib/willab/documentParts";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import {
  type CoachMessage,
  type DocumentSuggestion,
} from "@/services/api/idealText";

/** The Lounge thread; null outside it (O1–O3), a stub for O4. */
const chat = vi.hoisted(() => ({ thread: null as unknown }));
vi.mock("./LoungeThreadContext", () => ({ useLoungeThreadMaybe: () => chat.thread }));
vi.mock("@/services/api/consentChoices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/consentChoices")>()),
  practiseOfferedNow: () => true,
  readPractiseOffered: async () => true,
}));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));
vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({ default: () => createElement("div") }));
vi.mock("@/services/api/bookmarkHistory", () => ({
  fetchOwnerAnswers: vi.fn(async () => [{ feedbackId: "s-cv", response: "yes" }]),
  fetchParagraphHistory: vi.fn(async () => null),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SLIDES = [
  "Good morning. Today I want to show you how the pilot changed our numbers.",
  "Three things stood out: retention went up, churn went down, and the team stayed calm.",
  "So here is what I am asking for: one more quarter of the same budget.",
];
const text = SLIDES.join("\n\n");
const offset = text.indexOf("retention went up");
/** The moment on paragraph 2, already answered on this Take. */
const answered: DocumentSuggestion = {
  id: "s-cv", start: offset, end: offset + "retention went up".length,
  quote: "retention went up", kind: "advice", proposedText: null,
  feedbackFamily: "confident_voice", source: "confident_voice",
  device: null, tentative: false, status: "approved", bookmarkTier: "confident",
  snippetAudioRef: "https://media/moment.wav", startOffsetMs: 0, durationMs: 9000,
} as DocumentSuggestion;

const WORD: CoachMessage = {
  text: "Your opening landed. Keep the pause.",
  videoUrl: null,
  takeIndex: 2,
  publishedAt: "2026-10-05T09:00:00Z",
  takeSessionId: "take-2",
  // The server's "new" for this word (N80).
  unseen: true,
};

const noop = async () => true;
function props(over: Record<string, unknown> = {}) {
  const parts: Part[] = SLIDES.map((t, i) => ({ id: `p${i + 1}`, text: t }));
  return {
    title: "My Q3 pitch",
    document: text,
    parts,
    suggestions: [answered],
    pieceSlideIndexes: [0, 1, 2],
    piecePartIds: ["p1", "p2", "p3"],
    slideTitles: ["Opening", "Results", "The ask"],
    takeSessionId: "take-2",
    onAccept: vi.fn(noop),
    onKeepMine: vi.fn(noop),
    onLockPart: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
    onSetRootPhrase: vi.fn(noop),
    onEditSlide: vi.fn(noop),
    onClose: vi.fn(),
    ...over,
  };
}

Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => undefined);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => undefined);

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  chat.thread = null;
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(over: Record<string, unknown> = {}) {
  await act(async () => {
    root.render(createElement(TranscriptReviewDeck, props(over)));
  });
}
const step0 = () => document.querySelector("[data-coach-message-step]");
const pager = () => document.querySelector('[data-testid="feedback-pager"]');
const walkScreen = () =>
  document.querySelector("[data-feedback-walk] .walk-layer:not(.walk-ghost) [data-testid^='walk-screen-']");

/* ------------------------------------------------- the Take's coach word ---- */

describe("N80: the coach's word for the Take on screen", () => {

  it("every moment answered: Review feedback stays for the unseen word, opens Step 0 on its tap only, and goes once watched with Continue", async () => {
    const waiting = vi.fn();
    const at = (reviewRequest: number, coachMessage: CoachMessage = WORD) =>
      render({ arcId: "arc-1", coachMessage, onReviewWaiting: waiting, reviewRequest });
    await at(0);
    // J1: nothing opens by itself.
    expect(step0()).toBeNull();
    expect(waiting).toHaveBeenLastCalledWith(true);
    // The speaker taps "Review feedback": the walk opens on the coach's note.
    await at(1);
    expect(walkScreen()?.getAttribute("data-testid")).toBe("walk-screen-coachnote");
    expect(walkScreen()?.textContent).toContain(WORD.text);
    // Opening it is not watching it (N80): Review feedback stays.
    expect(waiting).toHaveBeenLastCalledWith(true);
    // ✕ marks nothing: Review feedback stays.
    // The lens is one chat (N81): ✕ is the thread's bar's.
    await act(async () => document.querySelector<HTMLButtonElement>('[data-feedback-walk] .walk-layer:not(.walk-ghost) button[aria-label="Close"]')!.click());
    expect(waiting).toHaveBeenLastCalledWith(true);
    // Opened again, Continue watches it: the server hears it, and nothing
    // waits, so the walk moves past its last screen.
    await at(2);
    const cont = [...document.querySelectorAll("button")].find((b) => b.textContent === "Continue")!;
    await act(async () => cont.click());
    expect(waiting).toHaveBeenLastCalledWith(false);
    expect(walkScreen()).toBeNull();
    expect(pager()).toBeNull();
    const seen = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/api/v2/user/coach-feedback/seen"));
    expect(seen).toHaveLength(1);
    expect(JSON.parse(String(seen[0][1]?.body))).toEqual({ take_session_id: "take-2" });
    // The coach changes their word (the same words, a new video): it is
    // new again (D7), and Review feedback is back.
    await at(2, { ...WORD, videoUrl: "https://media/coach-feedback/take-2/new.mp4?sig=1" });
    expect(waiting).toHaveBeenLastCalledWith(true);
  });

  it("every moment answered: a bubble tapped in the Lounge opens the walk on its moment, never the text", async () => {
    // The Lounge's bubble for the answered moment (its praise on paragraph 2).
    const reviewAt = { step: "praise", moment: 0, take: "take-2", part: "p2" };
    for (const word of [WORD, { ...WORD, unseen: false }]) {
      const reveal = vi.fn();
      const p = { arcId: "arc-1", coachMessage: word, reviewAt, onLensReveal: reveal };
      await render({ ...p, reviewRequest: 0 });
      await render({ ...p, reviewRequest: 1 });
      // The Take's answers are read first; then the walk opens.
      for (let i = 0; i < 6; i += 1) {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 0));
        });
      }
      // The walk as given, open on the praise, the rest of it there to
      // scroll; the text never shown in its place.
      const live = document.querySelector("[data-feedback-walk] .walk-layer:not(.walk-ghost)");
      expect(live).not.toBeNull();
      // The walk stands on the praise, its Next in the dock; the coach's
      // word above it and the helper words it was answered with below, one
      // thread to scroll (founder 2026-10-21).
      expect(live!.querySelector("[data-walk-now] [data-testid='walk-screen-praise']")).not.toBeNull();
      expect(live!.textContent).toContain(word.text);
      expect(live!.textContent).toContain(COPY.titleEmphasis);
      expect(live!.querySelector("[data-walk-dock] [data-testid='walk-forward']")!.textContent).toBe(COPY.pagerNext);
      expect(reveal).not.toHaveBeenCalled();
      await act(async () => root.unmount());
      root = createRoot(container);
    }
  });
});

describe("B10: the Feedback walk opens the walk, never the text", () => {
  it("every moment answered: the Feedback walk naming no step of the walk opens it on its newest step, never the text", async () => {
    // The Feedback walk of a walk paused on its summary, and of a walk with
    // no part to stand on: the Take alone.
    for (const reviewAt of [{ step: "summary", take: "take-2" }, { take: "take-2" }]) {
      const reveal = vi.fn();
      const p = { arcId: "arc-1", coachMessage: { ...WORD, unseen: false }, reviewAt, onLensReveal: reveal };
      await render({ ...p, reviewRequest: 0 });
      await render({ ...p, reviewRequest: 1 });
      for (let i = 0; i < 6; i += 1) {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 0));
        });
      }
      // The whole walk as given, on its newest step (the praise's helper
      // words), the coach's word and the praise above to scroll.
      const live = document.querySelector("[data-feedback-walk] .walk-layer:not(.walk-ghost)");
      expect(live).not.toBeNull();
      expect(live!.querySelector("[data-walk-now] [data-testid='walk-screen-helpers']")).not.toBeNull();
      expect(live!.textContent).toContain(WORD.text);
      expect(reveal).not.toHaveBeenCalled();
      await act(async () => root.unmount());
      root = createRoot(container);
    }
  });
});

describe("B10: every door opens the whole Take's walk", () => {
  it("one moment still waiting: its bubble opens the whole walk, the waiting step live, nothing new in the chat", async () => {
    const at3 = text.indexOf("one more quarter");
    // Paragraph 3's corrected moment, still waiting: its Exercise.
    const waiting = {
      ...answered, id: "s-cv3", start: at3, end: at3 + "one more quarter".length, quote: "one more quarter",
      status: null, bookmarkTier: "weak", practicePrompt: true, snippetId: "snip-3", blockId: "block-3",
      evidence: { kind: "snippet" },
    } as unknown as DocumentSuggestion;
    const append = vi.fn(async (draft: unknown) => draft);
    chat.thread = { messages: [], loading: false, append, reload: vi.fn(async () => undefined) };
    // Its AI clip is on its way: a correction with nothing to offer is
    // passed over (founder 2026-10-21, N108), this one stands.
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/confidence-practice")) {
        return json({ practice: {
          id: "11111111-1111-4111-8111-111111111111", status: "open", kind: "plain", passage: "one more quarter", attempts: [],
          exercise: { exercise_id: "plain", version: 1, title: "", instruction: "" },
        } });
      }
      // Still being made, its problem already chosen (N120): the chat can say it.
      if (url.endsWith("/ai-voice")) {
        return json({ demo: "ai_voice", clip: { state: "pending", url: null, problem: "stress", phrase: "one more quarter" } });
      }
      return new Response("{}", { status: 404 });
    }));
    // The Lounge's Exercise bubble: the Take's walk numbered it 1, after the
    // praise on paragraph 2.
    const reviewAt = { step: "exVideo", moment: 1, take: "take-2", part: "p3" };
    const p = { arcId: "arc-1", coachMessage: null, reviewAt, suggestions: [answered, waiting] };
    await render({ ...p, reviewRequest: 0 });
    await render({ ...p, reviewRequest: 1 });
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }
    const live = document.querySelector("[data-feedback-walk] .walk-layer:not(.walk-ghost)");
    expect(live).not.toBeNull();
    // The whole walk: the answered praise on Slide 2 above, to scroll back to.
    expect(live!.querySelector("[data-walk-mark='Slide 2']")).not.toBeNull();
    // The Exercise stands live, its Practise in the dock.
    expect(live!.querySelector("[data-walk-now] [data-testid='walk-screen-exVideo']")).not.toBeNull();
    expect(live!.querySelector("[data-walk-dock] [data-testid='walk-practise']")).not.toBeNull();
    // What the chat hears of it keeps the Take's number, so it is the same
    // message as before, never a new one at the bottom.
    const moments = append.mock.calls
      .map(([draft]) => (draft as { metadata: { step: string; moment: number | null } }).metadata)
      .filter((m) => m.step === "exVideo")
      .map((m) => m.moment);
    expect(moments.length).toBeGreaterThan(0);
    expect(moments).toEqual(moments.map(() => 1));
  });
});

describe("N48.2 Q6 A: after Delete the paragraph rejoins the walk", () => {
  // At the deck's own rule (buildBookmarks + helperWordsDeleted): the paragraph
  // was answered on an earlier Take and has nothing open now.
  const chunk = (part: Part) => ({ part }) as unknown as DeckChunk;
  const answeredEarlier = () => ({ pending: 0, decided: 1 });
  const walkOf = (part: Part, deletedHere = false) =>
    buildBookmarks(
      [chunk(part)],
      answeredEarlier,
      () => undefined,
      () => false,
      (c) => helperWordsDeleted(c.part, deletedHere, false),
    ).map((b) => b.partId);

  it("a paragraph whose helper words were deleted is back in the walk on its earlier answer", () => {
    // Never locked: an answered paragraph is not a moment of this walk.
    expect(walkOf({ id: "p2", text: SLIDES[1], locked: false, iteration: 0 })).toEqual([]);
    // Deleted on the server (once locked, unlocked now): it rejoins.
    expect(walkOf({ id: "p2", text: SLIDES[1], locked: false, iteration: 1 })).toEqual(["p2"]);
    // Deleted on this screen, before the next read says so: it rejoins at once.
    expect(walkOf({ id: "p2", text: SLIDES[1], locked: false, iteration: 0 }, true)).toEqual(["p2"]);
  });
});
