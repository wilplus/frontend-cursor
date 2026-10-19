// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  STORY    As a speaker, I want to discard a bad Take while it is still     */
/*           uploading, and not be offered that once the server has it, so    */
/*           that a bad Take leaves no trace and I am never promised          */
/*           something that cannot happen.                                    */
/*  OUTCOME                                                                   */
/*    O1  "Discard this take" shows while the upload is in flight.            */
/*    O2  Once the server has answered (canDiscard false) it is gone, and the */
/*        waiting screen is still there.                                      */
/*    O3  Pressing it hands the discard to the host (which confirms, then     */
/*        aborts the upload).                                                 */
/*  PROVES   O1, O3 -> "shows the discard control while the upload is in flight, and pressing it discards" */
/*           O2 -> "hides it once the server has the take"                    */
/*  WHY      Founder 2026-09-16, dead-end 2 of 3: the abort is the one window */
/*           in which a Take leaves no server trace.                          */
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

const discardButton = () =>
  Array.from(host.querySelectorAll("button")).find(
    (b) => (b.textContent ?? "").trim() === "Discard this take",
  );

describe("the waiting screen offers a way out while the upload is in flight", () => {
  it("shows the discard control while the upload is in flight, and pressing it discards", async () => {
    const onDiscard = vi.fn();
    expect(await render({ canDiscard: true, onDiscard })).toContain("Discard this take");
    await act(async () => discardButton()!.click());
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("hides it once the server has the take", async () => {
    const onDiscard = vi.fn();
    const labels = await render({ canDiscard: false, onDiscard });
    expect(host.textContent).not.toBe("");
    expect(labels).not.toContain("Discard this take");
    expect(onDiscard).not.toHaveBeenCalled();
  });
});
