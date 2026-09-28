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
  it("shows nothing when the write lands", async () => {
    await act(async () => {
      api.saveBehind(async () => "ok", "Couldn't save your answer.");
    });
    await flush();
    expect(container.querySelector("[data-save-behind]")).toBeNull();
  });

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

  it("a thrown write counts as a failure, not a silent loss", async () => {
    await act(async () => {
      api.saveBehind(async () => {
        throw new Error("network");
      }, "Couldn't save those words.");
    });
    await flush();
    expect(container.textContent).toContain("Couldn't save those words.");
    expect(container.textContent).toContain("Retry");
  });

  it("a final refusal shows the notice without Retry", async () => {
    await act(async () => {
      api.saveBehind(async () => "final", "Couldn't save your answer.");
    });
    await flush();
    expect(container.textContent).toContain("Couldn't save your answer.");
    expect(container.textContent).not.toContain("Retry");
  });
});

describe("helperWordsBehind (Use this phrase)", () => {
  const chunk = { part: { text: "We should ship it now." } };

  it("saves the words and locks the untouched paragraph together", async () => {
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
    // Both writes ran, and the lock carried the untouched paragraph.
    expect(order).toEqual(["root", "lock:We should ship it now."]);
  });

  it("either write failing is retryable; a blocked lock is final", async () => {
    const ok = async () => ({ outcome: "ok" });
    const blocked = async () => ({ outcome: "blocked" });
    expect(await helperWordsBehind(async () => false, ok, chunk, "s")).toBe("failed");
    expect(
      await helperWordsBehind(async () => true, async () => ({ outcome: "failed" }), chunk, "s"),
    ).toBe("failed");
    expect(await helperWordsBehind(async () => true, blocked, chunk, "s")).toBe("final");
  });
});
