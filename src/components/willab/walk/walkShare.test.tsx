// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  Sharing in the Feedback walk (build plan D-FW-20; walk lock flow 11;       */
/*  CM2 B, WQ5 A, WQ6 A, Q-B6 A, S-B6 A).                                      */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import FeedbackWalk from "./FeedbackWalk";
import { buildFeedbackWalk, type FeedbackWalkItem } from "@/lib/willab/feedbackWalkModel";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import {
  EMPTY_SHARE_FIELDS,
  SHARE_WORDS_VERSION,
  newShareMemo,
  runShare,
  shareReady,
  type ShareIO,
} from "@/lib/willab/walkShare";
import type { Outcome } from "@/services/api/practiceCheck";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clip = { src: "data:audio/wav;base64,", startOffsetMs: 0, durationMs: 9000 };
const ITEMS: FeedbackWalkItem<string>[] = [
  { partId: "p1", start: 0, slide: 1, blockId: "b1", feedbackFamily: "confident_voice", paragraphText: "One.", slideLabel: "Slide 2", clip, judge: "cv-1" },
  { partId: "p2", start: 50, slide: 1, blockId: "b2", feedbackFamily: "confident_voice", paragraphText: "Two.", slideLabel: "Slide 2", clip, judge: "cv-2" },
];

type Call = { kind: "join" | "create" | "share"; args: unknown };

/** A fake server: each call answers from its queue, else ok. */
function fakeIO(answers: Partial<Record<Call["kind"], Outcome<unknown>[]>> = {}) {
  const calls: Call[] = [];
  const next = <T,>(kind: Call["kind"], ok: T): Promise<Outcome<T>> =>
    Promise.resolve((answers[kind]?.shift() as Outcome<T> | undefined) ?? { ok: true, data: ok });
  const io: ShareIO = {
    join: (passCode) => {
      calls.push({ kind: "join", args: passCode });
      return next("join", { id: "joined-1" });
    },
    create: (name, passCode) => {
      calls.push({ kind: "create", args: { name, passCode } });
      return next("create", { id: "created-1" });
    },
    share: (choice) => {
      calls.push({ kind: "share", args: choice });
      return next("share", {});
    },
  };
  return { io, calls };
}

describe("walkShare (pure)", () => {
  it("Continue waits for a tick, and for every ticked field; a pass code has six characters", () => {
    expect(shareReady([], EMPTY_SHARE_FIELDS)).toBe(false);
    expect(shareReady(["general"], EMPTY_SHARE_FIELDS)).toBe(true);
    expect(shareReady(["none"], EMPTY_SHARE_FIELDS)).toBe(true);
    expect(shareReady(["mine"], { ...EMPTY_SHARE_FIELDS, minePassCode: "abc" })).toBe(false);
    expect(shareReady(["mine"], { ...EMPTY_SHARE_FIELDS, minePassCode: "abcdef" })).toBe(true);
    expect(shareReady(["own"], { ...EMPTY_SHARE_FIELDS, ownPassCode: "abcdef" })).toBe(false);
    expect(shareReady(["own"], { ...EMPTY_SHARE_FIELDS, ownName: "Team", ownPassCode: "abcdef" })).toBe(true);
  });

  it("the words version is the signed sharing screen's", () => {
    expect(SHARE_WORDS_VERSION).toBe("sharing-screen-2026-10-06");
  });

  it('"None" takes the share back, alone, with no words version', async () => {
    const { io, calls } = fakeIO();
    expect(await runShare(io, ["none"], EMPTY_SHARE_FIELDS, newShareMemo())).toEqual({ ok: true });
    expect(calls).toEqual([
      { kind: "share", args: { general: false, communityIds: [], none: true, shareWordsVersion: null } },
    ]);
  });

  it("joins and sets up first, then one share naming every community, with the words version", async () => {
    const { io, calls } = fakeIO();
    const fields = { minePassCode: " team-code ", ownName: " My club ", ownPassCode: "club-code" };
    expect(await runShare(io, ["general", "mine", "own"], fields, newShareMemo())).toEqual({ ok: true });
    expect(calls).toEqual([
      { kind: "join", args: "team-code" },
      { kind: "create", args: { name: "My club", passCode: "club-code" } },
      {
        kind: "share",
        args: { general: true, communityIds: ["joined-1", "created-1"], none: false, shareWordsVersion: SHARE_WORDS_VERSION },
      },
    ]);
  });

  it("each refusal names its signed message", async () => {
    const fields = { minePassCode: "abcdef", ownName: "Club", ownPassCode: "abcdef" };
    const unknown = fakeIO({ join: [{ ok: false, status: 404, code: "COMMUNITY_NOT_FOUND" }] });
    expect(await runShare(unknown.io, ["mine"], fields, newShareMemo())).toEqual({ ok: false, refusal: "passCodeUnknown" });
    const taken = fakeIO({ create: [{ ok: false, status: 409, code: "PASS_CODE_TAKEN" }] });
    expect(await runShare(taken.io, ["own"], fields, newShareMemo())).toEqual({ ok: false, refusal: "passCodeTaken" });
    const terms = fakeIO({ share: [{ ok: false, status: 409, code: "TERMS_REACCEPT_REQUIRED" }] });
    expect(await runShare(terms.io, ["general"], fields, newShareMemo())).toEqual({ ok: false, refusal: "acceptTerms" });
    const down = fakeIO({ share: [{ ok: false, status: 500, code: "V2_ERROR" }] });
    expect(await runShare(down.io, ["general"], fields, newShareMemo())).toEqual({ ok: false, refusal: "failed" });
    expect(taken.calls.some((c) => c.kind === "share")).toBe(false);
  });

  it("a community set up before a refused share is not set up twice on the next try", async () => {
    const { io, calls } = fakeIO({ share: [{ ok: false, status: 409, code: "TERMS_REACCEPT_REQUIRED" }] });
    const memo = newShareMemo();
    const fields = { minePassCode: "", ownName: "Club", ownPassCode: "abcdef" };
    await runShare(io, ["own"], fields, memo);
    expect(await runShare(io, ["own"], fields, memo)).toEqual({ ok: true });
    expect(calls.filter((c) => c.kind === "create")).toHaveLength(1);
  });
});

describe("the model", () => {
  it("sharing follows the judging only where the host turns it on", () => {
    const keys = (sharing?: boolean) =>
      buildFeedbackWalk({ items: ITEMS, coachNote: false, practiceOn: false, guest: false, sharing }).plan.map((s) => s.key);
    expect(keys(true)).toEqual(["page", "intro", "judge", "judge", "community", "end"]);
    expect(keys(false)).not.toContain("community");
    expect(keys(undefined)).not.toContain("community");
  });

  it("sharing never stands alone: nothing to review opens nothing", () => {
    const model = buildFeedbackWalk({ items: [], coachNote: false, practiceOn: false, guest: false, sharing: true });
    expect(model.plan.map((s) => s.key)).toEqual(["page", "end"]);
  });
});

let host: HTMLDivElement;
let root: Root;
let ended: number;
let skipped: string[][];
beforeEach(() => {
  vi.useFakeTimers();
  ended = 0;
  skipped = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function draw(io: ShareIO | null) {
  const model = buildFeedbackWalk({ items: ITEMS, coachNote: false, practiceOn: false, guest: false, sharing: true });
  const props = {
    model,
    coachNote: null,
    firstTake: false,
    onSaveHelperWords: () => undefined,
    onJudge: () => undefined,
    onSkipJudging: (items: string[]) => skipped.push(items),
    share: io,
    onEnd: () => {
      ended += 1;
    },
  };
  const at = model.plan.findIndex((s) => s.key === "intro");
  act(() => root.render(<FeedbackWalk {...props} request={null} />));
  act(() => root.render(<FeedbackWalk {...props} request={{ seq: 1, at }} />));
}

const live = () => host.querySelector<HTMLElement>(".walk-layer:not(.walk-ghost)");
const screen = () => live()?.querySelector<HTMLElement>("[data-testid^='walk-screen-']")?.dataset.testid ?? null;
const click = (el: Element | null | undefined) => act(() => (el as HTMLElement).click());
const byTestId = (id: string) => live()?.querySelector<HTMLElement>(`[data-testid='${id}']`) ?? null;
const option = (value: string) => live()!.querySelector<HTMLElement>(`[data-walk-option='${value}'] [role='checkbox']`);
const ticked = () =>
  [...live()!.querySelectorAll("[data-walk-option]")]
    .filter((o) => o.querySelector("[role='checkbox']")?.getAttribute("aria-checked") === "true")
    .map((o) => o.getAttribute("data-walk-option"));
const toast = () => host.querySelector("[data-walk-toast]")?.textContent ?? null;
const settle = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
});
function type(name: string, value: string) {
  const input = live()!.querySelector<HTMLInputElement>(`input[name='${name}']`)!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function judgeAll() {
  click(byTestId("walk-forward"));
  for (let i = 0; i < ITEMS.length; i += 1) {
    click(live()!.querySelector("[data-walk-answer='yes']"));
    act(() => vi.advanceTimersByTime(WALK_ANSWER_HOLD_MS));
  }
}

describe("the sharing screen in the walk", () => {
  it("comes after the judgements with the signed words, cross-fading in, then the end card", async () => {
    const { io, calls } = fakeIO();
    draw(io);
    judgeAll();
    expect(screen()).toBe("walk-screen-community");
    expect(live()!.dataset.walkMove).toBe("fade");
    const text = live()!.textContent ?? "";
    for (const words of [
      WALK_COPY.shareTitle,
      WALK_COPY.shareAsk,
      WALK_COPY.shareGeneral,
      WALK_COPY.shareGeneralHint,
      WALK_COPY.shareMine,
      WALK_COPY.shareMineHint,
      WALK_COPY.shareOwn,
      WALK_COPY.shareNone,
      WALK_COPY.shareNoneHint,
    ]) {
      expect(text).toContain(words);
    }
    expect(byTestId("walk-forward")!.textContent).toBe(COPY.pillContinue);
    expect((byTestId("walk-forward") as HTMLButtonElement).disabled).toBe(true);
    click(option("general"));
    expect((byTestId("walk-forward") as HTMLButtonElement).disabled).toBe(false);
    click(byTestId("walk-forward"));
    await settle();
    expect(calls).toEqual([
      { kind: "share", args: { general: true, communityIds: [], none: false, shareWordsVersion: SHARE_WORDS_VERSION } },
    ]);
    expect(ended).toBe(1);
  });

  it('Skip on "Judgement time!" still asks to share, then the end card (Q-B6 A)', async () => {
    const { io, calls } = fakeIO();
    draw(io);
    click(byTestId("walk-skip"));
    expect(skipped).toEqual([["cv-1", "cv-2"]]);
    expect(screen()).toBe("walk-screen-community");
    expect(ended).toBe(0);
    click(option("none"));
    click(byTestId("walk-forward"));
    await settle();
    expect(calls.map((c) => c.kind)).toEqual(["share"]);
    expect((calls[0].args as { none: boolean }).none).toBe(true);
    expect(ended).toBe(1);
  });

  it('several may be ticked; "None" stands alone; a ticked choice shows its fields', () => {
    draw(fakeIO().io);
    click(byTestId("walk-skip"));
    click(option("general"));
    click(option("mine"));
    expect(ticked()).toEqual(["general", "mine"]);
    expect(live()!.querySelector("input[name='minePassCode']")!.getAttribute("placeholder")).toBe(WALK_COPY.fieldPassCode);
    click(option("none"));
    expect(ticked()).toEqual(["none"]);
    expect(live()!.querySelector("input")).toBeNull();
    click(option("own"));
    expect(ticked()).toEqual(["own"]);
    const placeholders = [...live()!.querySelectorAll("input")].map((i) => i.getAttribute("placeholder"));
    expect(placeholders).toEqual([WALK_COPY.fieldCommunityName, WALK_COPY.fieldPassCode]);
  });

  it("a refusal stays on the screen with its signed message; fixed, it goes on", async () => {
    const { io, calls } = fakeIO({ join: [{ ok: false, status: 404, code: "COMMUNITY_NOT_FOUND" }] });
    draw(io);
    click(byTestId("walk-skip"));
    click(option("mine"));
    expect((byTestId("walk-forward") as HTMLButtonElement).disabled).toBe(true);
    type("minePassCode", "wrong-code");
    click(byTestId("walk-forward"));
    await settle();
    expect(screen()).toBe("walk-screen-community");
    expect(toast()).toBe(WALK_COPY.sharePassCodeUnknown);
    expect(ended).toBe(0);
    type("minePassCode", "right-code");
    click(byTestId("walk-forward"));
    await settle();
    expect(calls.map((c) => [c.kind, c.args])).toEqual([
      ["join", "wrong-code"],
      ["join", "right-code"],
      ["share", { general: false, communityIds: ["joined-1"], none: false, shareWordsVersion: SHARE_WORDS_VERSION }],
    ]);
    expect(ended).toBe(1);
  });

  it("✕ goes on to the end card without sharing", () => {
    const { io, calls } = fakeIO();
    draw(io);
    click(byTestId("walk-skip"));
    click(live()!.querySelector("[data-walk-close], [aria-label='Close']"));
    expect(calls).toEqual([]);
    expect(ended).toBe(1);
  });
});
