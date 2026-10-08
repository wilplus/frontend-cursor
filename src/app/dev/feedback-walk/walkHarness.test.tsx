// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE WALK HARNESS SAYS ONLY SIGNED WORDS, AND ITS PARITY FIXES HOLD         */
/*  (build plan D-FW-12; N53.3 NX1 A; prototype v10; Q-B6 A; Q-B4 A).         */
/*                                                                            */
/*  Every ?screen= of /dev/feedback-walk is rendered here. Each visible       */
/*  string must come from CHUNK_SHEET_COPY, WALK_COPY or WALK_LINE_BANK, or  */
/*  be the fixtures' sample content (the talk, the coach's lines, the        */
/*  stand-ins) or a position the harness composes from signed words. A word  */
/*  from anywhere else fails. Then the flow: "Keep my words" skips the        */
/*  practise; Skip on "Judgement time!" clears the bars and still asks to     */
/*  share; the Journal opens from the intro and "Back" returns. And nothing   */
/*  renders in production.                                                    */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY, WALK_COPY, WALK_LINE_BANK } from "@/components/willab/idealEditCopy";
import { PRIMARY_RATING_OPTIONS, SECONDARY_RATING_OPTIONS } from "@/components/willab/ConfidenceLabelChips";
import { aiGeneratedLabel } from "@/lib/willab/aiGeneratedMark";
import FeedbackWalkHarness from "./page";
import { LoungeStandIn, renderWalkScreen, type WalkCtx } from "./walkScreens";
import {
  COACH_NOTE,
  JOURNAL_POST,
  LOUNGE_STANDIN,
  MOMENTS,
  PARAGRAPHS,
  PAGE_WORDS,
  PROJECT_TITLE,
  SCREEN_NAMES,
  SLIDE_LABEL,
  TAKE_SHOWN,
} from "./walkFixtures";

vi.mock("@/components/willab/CoachVideo", () => ({
  default: () => createElement("div", { "data-coach-video": "" }),
}));

/* ------------------------------ the words ----------------------------------- */

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  // A line with a number in it ("2 of 4 words", "Take 2"): the signed form,
  // read with the counts a screen can show.
  if (typeof value === "function") {
    return [0, 1, 2, 3, 4].flatMap((n) => {
      try {
        const out = (value as (x: number) => unknown)(n);
        return typeof out === "string" ? [out] : [];
      } catch {
        return [];
      }
    });
  }
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** The app's shared primitives' spoken names, read out and never shown: the
 *  one close X's "Close" (OverlayCloseButton) and the one player's "Play …"
 *  / "Pause …" (SnippetWavePlayer), which the walk reuses (walk lock, "UI
 *  and UX": one player everywhere). */
const SPOKEN = new Set(["Close", "Play", "Pause"]);

/** The signed words: the three copy objects, the shared answer vocabulary. */
const SIGNED = new Set([
  ...strings(CHUNK_SHEET_COPY),
  ...strings(WALK_COPY),
  ...strings(WALK_LINE_BANK),
  ...PRIMARY_RATING_OPTIONS.map((o) => o.label),
  ...SECONDARY_RATING_OPTIONS.map((o) => o.label),
]);

/** The fixtures' sample content: the talk, the coach's lines, the stand-ins,
 *  and the page's words the harness composes (positions, the Take). */
const SAMPLE = new Set<string>([
  ...PARAGRAPHS,
  COACH_NOTE,
  ...MOMENTS.flatMap((m) => [
    m.praise?.text ?? "",
    m.clearer?.say ?? "",
    m.clearer?.coachLine ?? "",
    m.exercise?.instruction ?? "",
    ...(m.clearer?.before ?? []).map((p) => p.text),
    ...(m.clearer?.after ?? []).map((p) => p.text),
  ]),
  ...PARAGRAPHS.flatMap((p) => p.split(" ")),
  JOURNAL_POST.title,
  ...JOURNAL_POST.body.split("\n\n"),
  LOUNGE_STANDIN.speakerMessage,
  PROJECT_TITLE,
  SLIDE_LABEL,
  "WillpowerLab",
  aiGeneratedLabel("ideal-text", TAKE_SHOWN),
  PAGE_WORDS.reviewFeedback,
  PAGE_WORDS.recordTake(TAKE_SHOWN + 1),
  `${CHUNK_SHEET_COPY.historyTake} ${TAKE_SHOWN}`,
  // The moment bar: "Slide 2 · moment 1 of 4", and the picker's count.
  ...MOMENTS.map((m) => `${SLIDE_LABEL} · ${CHUNK_SHEET_COPY.pagerMoment} ${m.index + 1} ${CHUNK_SHEET_COPY.pagerOf} ${MOMENTS.length}`),
  ...MOMENTS.map((m) => `${CHUNK_SHEET_COPY.pagerMoment} ${m.index + 1} ${CHUNK_SHEET_COPY.pagerOf} ${MOMENTS.length}`),
].filter(Boolean));

function visibleStrings(scope: ParentNode): string[] {
  const out: string[] = [];
  const push = (raw: string | null) => {
    const text = (raw ?? "").replace(/\s+/g, " ").trim();
    if (/[A-Za-z]/.test(text)) out.push(text);
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) return push(node.textContent);
    if (!(node instanceof Element)) return;
    if (node.classList.contains("sr-only") || node.getAttribute("aria-hidden") === "true") return;
    for (const attr of ["aria-label", "placeholder", "title"]) push(node.getAttribute(attr));
    const children = [...node.childNodes];
    if (children.length > 0 && children.every((c) => c.nodeType === Node.TEXT_NODE)) return push(node.textContent);
    children.forEach(walk);
  };
  walk(scope as Node);
  return out;
}

/** Allowed: a signed word, sample content, or a run of them the screen
 *  composes ("0 of 4 words": the picker's count from the signed words). */
function allowed(s: string): boolean {
  if (SIGNED.has(s) || SAMPLE.has(s) || SPOKEN.has(s)) return true;
  const spoken = /^(Play|Pause) (.+)$/.exec(s);
  if (spoken && allowed(spoken[2])) return true;
  const parts = s.split(/\s*·\s*|\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => SIGNED.has(p) || SAMPLE.has(p) || /^\d+$/.test(p))) return true;
  for (const head of [...SIGNED, ...SAMPLE]) {
    if (s.startsWith(`${head} `) && allowed(s.slice(head.length + 1))) return true;
  }
  return false;
}

/* ------------------------------ the harness --------------------------------- */

let host: HTMLDivElement;
let root: Root;

function at(search: string) {
  window.history.replaceState(null, "", `/dev/feedback-walk${search}`);
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:tone", revokeObjectURL: () => undefined }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  at("");
});

function mount(search: string) {
  at(search);
  act(() => root.render(createElement(FeedbackWalkHarness)));
}

const stepKey = () => host.querySelector("[data-walk-step]")?.getAttribute("data-walk-step")?.split(":")[1];
const click = (testId: string) => {
  const el = host.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement | null;
  if (!el) throw new Error(`no ${testId} on ${stepKey()}`);
  act(() => el.click());
};

describe("every screen says only signed words or the fixtures' sample content", () => {
  it.each([...SCREEN_NAMES])("?screen=%s", (name) => {
    mount(`?screen=${name}`);
    const shown = visibleStrings(host);
    expect(shown.length, "drew nothing").toBeGreaterThan(0);
    const bad = shown.filter((s) => !allowed(s));
    expect(bad, `${name} shows words nobody signed:\n${bad.join("\n")}`).toEqual([]);
  });

  it("the Journal shows its signed eyebrow", () => {
    mount("?screen=journal");
    expect(host.querySelector("[data-walk-eyebrow]")?.textContent).toBe(WALK_COPY.journalEyebrow);
    expect(WALK_COPY.journalEyebrow).toBe("Journal");
  });

  it("the Lounge shows the marked bubble with its signed 'new' tag", () => {
    mount("?screen=lounge");
    const bubble = host.querySelector('[data-testid="walk-lounge-bubble"]') as HTMLElement;
    expect(bubble.getAttribute("data-walk-marked")).toBe("true");
    expect(bubble.textContent).toContain(CHUNK_SHEET_COPY.chipNew);
  });

  it("after the walk the Lounge's bubble loses its mark and its 'new' tag", () => {
    act(() => root.render(createElement(LoungeStandIn, { onOpen: () => undefined, walked: true })));
    const bubble = host.querySelector('[data-testid="walk-lounge-bubble"]') as HTMLElement;
    expect(bubble.hasAttribute("data-walk-marked")).toBe(false);
    expect(bubble.className).not.toContain("outline-primary");
    expect(bubble.textContent).not.toContain(CHUNK_SHEET_COPY.chipNew);
  });

  it("the practice-off clearer version: Accept takes the accept path, Keep my words the keep path", () => {
    const acceptWords = vi.fn();
    const keepWords = vi.fn();
    const ctx = {
      step: { key: "clearerOff", moment: 1 },
      first: false,
      audioSrc: null,
      forward: vi.fn(),
      back: vi.fn(),
      close: vi.fn(),
      openJournal: vi.fn(),
      keepWords,
      acceptWords,
      skipJudging: vi.fn(),
      answers: {},
      answer: vi.fn(),
      helpers: {},
      pickHelpers: vi.fn(),
      community: [],
      setCommunity: vi.fn(),
      elapsed: 0,
    } as WalkCtx;
    act(() => root.render(createElement("div", null, renderWalkScreen(ctx))));
    const pill = host.querySelector('[data-testid="walk-forward"]') as HTMLButtonElement;
    expect(pill.textContent).toBe(WALK_COPY.clearerAccept);
    act(() => pill.click());
    expect(acceptWords).toHaveBeenCalledTimes(1);
    expect(keepWords).not.toHaveBeenCalled();
    act(() => (host.querySelector('[data-testid="walk-keep-words"]') as HTMLButtonElement).click());
    expect(keepWords).toHaveBeenCalledTimes(1);
    expect(acceptWords).toHaveBeenCalledTimes(1);
  });

  it("the checker catches a word nobody signed", () => {
    expect(allowed("A word nobody signed")).toBe(false);
    expect(allowed(`${SLIDE_LABEL} · ${CHUNK_SHEET_COPY.pagerMoment} 1 ${CHUNK_SHEET_COPY.pagerOf} 4`)).toBe(true);
  });
});

describe("the flow's parity fixes", () => {
  function toClearer() {
    mount("?flow=1");
    expect(stepKey()).toBe("lounge");
    click("walk-lounge-bubble");
    expect(stepKey()).toBe("page");
    click("walk-review");
    for (let guard = 0; guard < 12 && stepKey() !== "clearer"; guard += 1) {
      if (stepKey() === "helpers") click("walk-skip");
      else click("walk-forward");
    }
    expect(stepKey()).toBe("clearer");
  }

  it("Keep my words skips the practise: the walk goes on with the next moment", () => {
    toClearer();
    click("walk-keep-words");
    expect(stepKey()).toBe("exVideo");
    expect(host.querySelector("[data-walk-recording-strip]")).toBeNull();
  });

  it("Accept and practise still records", () => {
    toClearer();
    click("walk-forward");
    expect(stepKey()).toBe("practise");
    expect(host.querySelector("[data-walk-recording-strip]")).not.toBeNull();
  });

  function toIntro() {
    toClearer();
    click("walk-keep-words");
    for (let guard = 0; guard < 12 && stepKey() !== "intro"; guard += 1) {
      const key = stepKey();
      if (key === "helpers") click("walk-skip");
      else if (key === "exVideo") click("walk-forward");
      else if (key === "practise") act(() => (host.querySelector("[data-walk-recording-strip] button") as HTMLButtonElement).click());
      else if (key === "processing") act(() => vi.advanceTimersByTime(2300));
      else click("walk-forward");
    }
    expect(stepKey()).toBe("intro");
  }

  it("Skip on Judgement time! clears the bars and still asks to share, then the end card (Q-B6 A)", () => {
    vi.useFakeTimers();
    try {
      toIntro();
      click("walk-skip");
      expect(stepKey()).toBe("community");
      expect(host.querySelector("[data-walk-options]")).not.toBeNull();
      // Tick a choice and continue: the end card, over a page with no bar.
      act(() => (host.querySelector('[data-walk-option="general"] [role="checkbox"]') as HTMLElement).click());
      click("walk-forward");
      expect(stepKey()).toBe("end");
      expect(host.querySelector("[data-walk-endsheet]")).not.toBeNull();
      const bars = [...host.querySelectorAll("[data-testid='walk-page'] p > span[aria-hidden]")];
      expect(bars.length).toBe(PARAGRAPHS.length);
      expect(bars.every((b) => b.className.includes("bg-transparent"))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the Journal opens from Judgement time! and Back returns to it", () => {
    vi.useFakeTimers();
    try {
      toIntro();
      click("walk-journal");
      expect(stepKey()).toBe("journal");
      expect(host.textContent).toContain(WALK_COPY.journalEyebrow);
      click("walk-journal-back");
      expect(stepKey()).toBe("intro");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("nothing renders in production", () => {
  it("the harness returns null under NODE_ENV=production", () => {
    const src = readFileSync("src/app/dev/feedback-walk/page.tsx", "utf8");
    expect(src).toMatch(/if \(process\.env\.NODE_ENV === "production"\) return null;/);
    for (const file of ["walkScreens.tsx", "walkFixtures.ts"]) {
      const imports = readFileSync(`src/app/dev/feedback-walk/${file}`, "utf8");
      // The product never imports the harness; the harness only imports the product.
      expect(imports).not.toMatch(/from "@\/app\/dev/);
    }
    const product = readFileSync("src/components/willab/IdealTextOverlay.tsx", "utf8");
    expect(product).not.toMatch(/dev\/feedback-walk/);
  });
});
