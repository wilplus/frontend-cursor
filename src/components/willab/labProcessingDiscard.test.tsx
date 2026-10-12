// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  DISCARDING A TAKE THAT IS STILL GOING UP                                   */
/*  (founder 2026-09-16, dead-end 2 of 3)                                      */
/*                                                                            */
/*  Once the speaker pressed stop there was no way back: the take went up, and */
/*  a bad one had to be watched all the way into the library. The way out is   */
/*  the abort — and ONLY the abort, because that is the one window in which a  */
/*  take leaves no server trace. The moment the server answers, the control    */
/*  disappears rather than offering something it cannot do.                   */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Processing } from "./LabOverlay";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const base = {
  error: null,
  progress: { stage: "processing_recording", percent: 20 },
  onRetry: () => undefined,
  onClose: () => undefined,
};

async function render(over: Record<string, unknown> = {}) {
  await act(async () => {
    root.render(createElement(Processing, { ...base, ...over } as never));
  });
  return Array.from(host.querySelectorAll("button")).map((b) =>
    (b.textContent ?? "").trim(),
  );
}

describe("the waiting screen offers a way out while the upload is in flight", () => {
  it("shows the discard control while the upload is in flight", async () => {
    expect(
      await render({ canDiscard: true, onDiscard: () => undefined }),
    ).toContain("Discard this take");
  });

  it("does NOT show it once the server has answered", async () => {
    // THE BOUNDARY IS THE FEATURE. Past the response the take exists, and this
    // control cannot make it not exist.
    expect(
      await render({ canDiscard: false, onDiscard: () => undefined }),
    ).not.toContain("Discard this take");
    expect(await render()).not.toContain("Discard this take");
  });

  it("calls straight through, so the confirmation is the host's decision", async () => {
    const onDiscard = vi.fn();
    await render({ canDiscard: true, onDiscard });
    const button = Array.from(host.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === "Discard this take",
    )!;
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("never appears on the error, still-processing or slow panels", async () => {
    // Each of those describes a take the server ALREADY HAS. A discard there
    // would claim to undo something this control cannot reach.
    const on = { canDiscard: true, onDiscard: () => undefined };
    expect(await render({ ...on, error: "boom" })).not.toContain(
      "Discard this take",
    );
    expect(
      await render({ ...on, error: "still going", stillProcessing: true }),
    ).not.toContain("Discard this take");
    expect(await render({ ...on, slow: true })).not.toContain(
      "Discard this take",
    );
  });

  it("keeps a tap target big enough to hit on a phone", async () => {
    await render({ canDiscard: true, onDiscard: () => undefined });
    const button = Array.from(host.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === "Discard this take",
    )!;
    expect(button.className).toMatch(/min-h-\[44px\]/);
  });
});

