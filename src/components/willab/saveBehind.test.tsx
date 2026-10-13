// @vitest-environment jsdom
/** Tap and go (founder 2026-09-28): the writes the sheets no longer wait for,
 *  and the one notice a failure becomes. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  helperWordsBehind,
  useSaveBehind,
  type BehindOutcome,
} from "./saveBehind";
import { SaveBehindNotice } from "./WalkEnd";

vi.mock("@/services/api/takeFeedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/takeFeedback")>()),
  saveTakeFeedbackResponse: vi.fn(),
}));

let root: Root;
let container: HTMLDivElement;
let api: ReturnType<typeof useSaveBehind>;

function Host() {
  api = useSaveBehind();
  return createElement(SaveBehindNotice, {
    notice: api.notice,
    onGone: api.dismiss,
  });
}

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(Host));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await Promise.resolve(); });

describe("useSaveBehind", () => {

  it("a failure shows the notice, and Retry sends the same write again", async () => {
    const outcomes: BehindOutcome[] = ["failed", "ok"];
    const task = vi.fn(async () => outcomes.shift()!);
    await act(async () => {
      api.saveBehind(task, "Couldn't save your answer.");
    });
    await flush();
    const notice = container.querySelector("[data-save-behind]");
    expect(notice?.textContent).toContain("Couldn't save your answer.");
    const retry = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Retry",
    )!;
    await act(async () => {
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(task).toHaveBeenCalledTimes(2);
    expect(container.querySelector("[data-save-behind]")).toBeNull();
  });
});

describe("helperWordsBehind (Use this phrase)", () => {
  const chunk = { part: { text: "We should ship it now." } };

  it("locks the untouched paragraph first, then saves the words", async () => {
    const order: string[] = [];
    const setRoot = vi.fn(async () => {
      order.push("root");
      return true;
    });
    const lock = vi.fn(async (_c: typeof chunk, text: string) => {
      order.push(`lock:${text}`);
      return { outcome: "ok" };
    });
    expect(await helperWordsBehind(setRoot, lock, chunk, "span")).toBe("ok");
    // The lock stores the paragraphs a fresh Take lacks, so it goes first.
    expect(order).toEqual(["lock:We should ship it now.", "root"]);
  });
});
