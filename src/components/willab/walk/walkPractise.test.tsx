// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  The practise loop live in the Feedback walk (build plan D-FW-16; walk      */
/*  lock flow 7; N52.3, NX3 A, CM3a A, CM3b A, O5), with the app's own clients */
/*  on a mocked fetch and a mocked microphone.                                 */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY, WALK_LINE_BANK } from "../idealEditCopy";
import FeedbackWalk, { type FeedbackWalkPractiseWords } from "./FeedbackWalk";
import { buildFeedbackWalk, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";
import { walkPractiseIO } from "@/services/api/walkPractise";
import type { ConfidentVoicePracticeOffer } from "@/services/api/idealText";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/services/api/otherSpeakers", () => ({ fetchOtherClips: vi.fn(async () => []), answerOtherClip: vi.fn() }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));

/** The microphone: a stand-in for the app's recorder, counting what the walk
 *  asks of it. */
const mic = vi.hoisted(() => ({ starts: 0, stops: 0, cancels: 0, fail: false }));
vi.mock("@/hooks/useDualCaptureMic", async () => {
  const React = await import("react");
  type State =
    | { status: "idle" }
    | { status: "recording"; partialText: string }
    | { status: "stopped"; finalText: string; audioBlob: Blob; durationSec: number }
    | { status: "error"; code: string; message: string };
  return {
    useDualCaptureMic: () => {
      const [state, setState] = React.useState<State>({ status: "idle" });
      return {
        state,
        start: async () => {
          mic.starts += 1;
          setState(
            mic.fail
              ? { status: "error", code: "denied", message: "denied" }
              : { status: "recording", partialText: "" },
          );
        },
        stop: async () => {
          mic.stops += 1;
          setState({ status: "stopped", finalText: "", audioBlob: new Blob(["x".repeat(2000)]), durationSec: 4 });
        },
        cancel: () => {
          mic.cancels += 1;
          setState({ status: "idle" });
        },
        getAudioStartedAt: () => null,
      };
    },
  };
});

const SAID = "We think the timing matters, because the window closes once the incumbents catch up with pricing.";
const OFFERED = "The window closes once the incumbents match our price.";
const EVIDENCE = { projectId: "arc", takeSessionId: "take", slideIndex: 1, paragraphIndex: 0, start: 0, end: 10 };
const ITEMS: FeedbackWalkItem<string>[] = [
  {
    partId: "p3", start: 160, slide: 1, blockId: "b3", feedbackFamily: "rewrite_clarity",
    paragraphText: SAID, slideLabel: "Slide 2",
    clip: { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 11000 },
    rewrite: { quote: SAID, proposedText: OFFERED, item: "s-rewrite" },
    item: "s-rewrite",
  },
];

/** The exercise a moment carries (D-FW-17): the served offer. */
const EXERCISE_OFFER: ConfidentVoicePracticeOffer = {
  exerciseId: "ex-landing",
  version: 3,
  title: "Land the ending",
  instruction: "Slow down on the last word, then let it fall.",
  introduction: "",
  yesIntroduction: "",
  noIntroduction: "",
  explanationVideoRef: "https://media.example/ex-landing.mp4",
  passage: "Two hires by March keep that lead.",
  practiceId: null,
  resume: false,
  doneBefore: false,
  chosenByCoach: true,
};

/** What the check route answers, try by try; "hang" never answers. */
type Answer = { next: "praise" | "again" | "moved_on"; key: string } | "hang" | "fail";
let answers: Answer[];
let uploadFails: boolean;
let calls: { method: string; url: string; body: unknown }[];

function practiceJson(tries: number) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    status: "open",
    kind: "rewrite",
    exercise: { exercise_id: "rewrite", version: 1, title: "", instruction: "" },
    passage: OFFERED,
    attempts: Array.from({ length: tries }, (_, i) => ({
      id: `a${i + 1}`, attempt_index: i + 1, audio_ref: "x", duration_ms: 4000, assessment: "ok",
    })),
  };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";
  calls.push({ method, url, body: init?.body });
  if (url.includes("/snippets/") && url.endsWith("/confidence-practice")) {
    return Promise.resolve(json({ practice: practiceJson(0) }));
  }
  if (url.endsWith("/attempts")) {
    if (uploadFails) return Promise.resolve(json({ code: "TRANSCRIPTION_FAILED", error: "x" }, 422));
    const tries = calls.filter((c) => c.url.endsWith("/attempts")).length;
    return Promise.resolve(json({ practice: practiceJson(tries) }));
  }
  if (url.endsWith("/check")) {
    const answer = answers.shift() ?? "hang";
    if (answer === "hang") return new Promise(() => undefined);
    if (answer === "fail") return Promise.resolve(json({ code: "V2_ERROR" }, 500));
    return Promise.resolve(
      json({
        outcome: answer.next === "praise" ? "done" : answer.next,
        // What the server keeps for itself must never reach the screen.
        check: { ...answer, lane: "cue", z: 1.4, rule_version: "practice-check-v2" },
        attempt_transcript: answer.next === "praise" ? "the window closes once they match our price" : null,
        practice: practiceJson(1),
      }),
    );
  }
  return Promise.resolve(json({}, 404));
}

let host: HTMLDivElement;
let root: Root;
let saved: FeedbackWalkPractiseWords[];
let ended: number;
beforeEach(() => {
  Object.assign(mic, { starts: 0, stops: 0, cancels: 0, fail: false });
  answers = [];
  uploadFails = false;
  calls = [];
  saved = [];
  ended = 0;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  URL.createObjectURL = vi.fn(() => "blob:try");
  URL.revokeObjectURL = vi.fn();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function draw(
  over: {
    guest?: boolean;
    onGuest?: () => void;
    readLimitMs?: number;
    practiceOn?: boolean;
    items?: FeedbackWalkItem<string>[];
    at?: number;
  } = {},
) {
  const model = buildFeedbackWalk({ items: over.items ?? ITEMS, coachNote: false, practiceOn: over.practiceOn ?? true, guest: false });
  const io = walkPractiseIO<string>((item) => ({
    snippetId: "snip-1",
    evidence: EVIDENCE,
    feedbackId: item,
    exercise: item === "s-ex" ? EXERCISE_OFFER : null,
  }));
  const props = {
    model,
    coachNote: null,
    firstTake: false,
    guest: over.guest,
    onGuest: over.onGuest,
    readLimitMs: over.readLimitMs ?? 1000,
    practise: io,
    onSaveHelperWords: () => undefined,
    onSavePractiseWords: (s: FeedbackWalkPractiseWords) => saved.push(s),
    onEnd: () => {
      ended += 1;
    },
  };
  act(() => root.render(<FeedbackWalk {...props} request={null} />));
  act(() => root.render(<FeedbackWalk {...props} request={{ seq: 1, at: over.at ?? 1 }} />));
}

const live = () => host.querySelector<HTMLElement>(".walk-layer:not(.walk-ghost)");
const screen = () => live()?.querySelector<HTMLElement>("[data-testid^='walk-screen-']")?.dataset.testid ?? null;
const click = (el: Element | null | undefined) => act(() => (el as HTMLElement).click());
const forward = () => click(live()?.querySelector("[data-testid='walk-forward']"));
const message = () => live()?.querySelector("[data-walk-message]")?.textContent ?? null;
const stop = () => click(live()?.querySelector("[data-testid='walk-stop']"));
async function settle(ms = 0) {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });
  }
}
/** Accept and practise, from the clearer version. */
async function accept() {
  expect(screen()).toBe("walk-screen-clearer");
  forward();
  await settle();
}
/** Stop the try and let the machine answer. */
async function tryAndRead() {
  stop();
  expect(screen()).toBe("walk-screen-processing");
  await settle();
}

describe("the practise screen", () => {

  it("Stop uploads through the attempts route, cross-fades to the voice mark and posts /check", async () => {
    draw();
    await accept();
    answers = ["hang"];
    stop();
    expect(screen()).toBe("walk-screen-processing");
    expect(live()!.className).toContain("walk-m-fade");
    expect(live()!.querySelector("[data-walk-loading]")).not.toBeNull();
    await settle();
    const upload = calls.find((c) => c.url.endsWith("/attempts"))!;
    expect(upload.method).toBe("POST");
    expect(upload.body).toBeInstanceOf(FormData);
    expect(calls.some((c) => c.url.endsWith("/attempts/a1/check") && c.method === "POST")).toBe(true);
  });
});

describe("the machine's answer", () => {
  it("praise on try 1: a line of the signed bank, then helper words from the try's own words", async () => {
    draw();
    await accept();
    answers = [{ next: "praise", key: "cue:landed_ending" }];
    await tryAndRead();
    expect(screen()).toBe("walk-screen-improved");
    expect(live()!.querySelector("h2")!.textContent).toBe(COPY.titlePraise);
    expect(message()).toBe(WALK_LINE_BANK.B07.lines[0]);
    expect(live()!.querySelector("[data-walk-player]")).not.toBeNull();
    forward();
    expect(screen()).toBe("walk-screen-helpers");
    const words = [...live()!.querySelectorAll<HTMLButtonElement>("[data-walk-word-picker] button")];
    expect(words.map((w) => w.textContent)).toEqual("the window closes once they match our price".split(" "));
    click(words[6]); // "our"
    click(live()!.querySelectorAll<HTMLButtonElement>("[data-walk-word-picker] button")[7]); // "price"
    forward();
    expect(saved).toEqual([
      { practiceId: "11111111-1111-4111-8111-111111111111", partId: "p3", phrase: "our price" },
    ]);
    await act(async () => {}); // nobody to judge after practice: it moves on
    expect(ended).toBe(1);
  });
});

describe("the fences", () => {
  it("no number, lane or score in the DOM on any practise screen (AC-9)", async () => {
    draw();
    await accept();
    answers = [{ next: "again", key: "effort" }, { next: "praise", key: "cue:wide_range" }];
    const seen: string[] = [];
    seen.push(host.innerHTML);
    await tryAndRead();
    seen.push(host.innerHTML);
    forward();
    seen.push(host.innerHTML);
    await tryAndRead();
    seen.push(host.innerHTML);
    for (const html of seen) {
      expect(html).not.toMatch(/\blane\b|cue:|"z"|score|practice-check|rule_version|B0\d|NX3a|CM3b/i);
      const text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
      // The strip's clock and the moment's position are the only figures.
      expect(text.replace(/\d+:\d{2}/g, "").replace(/moment \d+ of \d+/gi, "").replace("Slide 2", "")).not.toMatch(/\d/);
    }
  });

  it("a guest's practise asks to sign up and records nothing", async () => {
    const onGuest = vi.fn();
    draw({ guest: true, onGuest });
    forward(); // Accept and practise
    await settle();
    expect(onGuest).toHaveBeenCalled();
    expect(mic.starts).toBe(0);
    expect(calls).toEqual([]);
  });
});
