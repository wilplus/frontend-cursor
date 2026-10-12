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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
});

