// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  Sharing in the Feedback walk (build plan D-FW-20; walk lock flow 11;       */
/*  CM2 B, WQ5 A, WQ6 A, Q-B6 A, S-B6 A).                                      */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SHARE_WORDS_VERSION,
  newShareMemo,
  runShare,
  type ShareIO,
} from "@/lib/willab/walkShare";
import type { Outcome } from "@/services/api/practiceCheck";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const live = () => host.querySelector<HTMLElement>(".walk-layer:not(.walk-ghost)");
const screen = () => live()?.querySelector<HTMLElement>("[data-testid^='walk-screen-']")?.dataset.testid ?? null;
const option = (value: string) => live()!.querySelector<HTMLElement>(`[data-walk-option='${value}'] [role='checkbox']`);
const toast = () => host.querySelector("[data-walk-toast]")?.textContent ?? null;
function type(name: string, value: string) {
  const input = live()!.querySelector<HTMLInputElement>(`input[name='${name}']`)!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
