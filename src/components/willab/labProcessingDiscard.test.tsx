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
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Processing } from "./LabOverlay";

const HOST = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");
const DIALOG = readFileSync(
  "src/components/willab/DiscardTakeDialog.tsx",
  "utf8",
);

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

describe("the host's half of the promise", () => {
  it("only offers the control while the request is actually in flight", () => {
    expect(HOST).toMatch(/canDiscard=\{uploadInFlight\}/);
    // ...and `uploadInFlight` is the request's own lifetime, nothing looser.
    expect(HOST).toMatch(/setUploadInFlight\(true\);\n\s*const result = await uploadForProcessing/);
    expect(HOST).toMatch(/uploadAbortRef\.current = null;\n\s*setUploadInFlight\(false\);/);
  });

  it("shuts the window BEFORE branching on the result", () => {
    // Ordering is the whole guarantee: a Discard tap that races the response
    // must not abort a request the server has already answered. The ref is
    // cleared between the await and the first branch.
    const body = HOST.slice(HOST.indexOf("const result = await uploadForProcessing"));
    const cleared = body.indexOf("uploadAbortRef.current = null");
    const firstBranch = body.indexOf("if (result.kind ===");
    expect(cleared).toBeGreaterThan(-1);
    expect(firstBranch).toBeGreaterThan(-1);
    expect(cleared).toBeLessThan(firstBranch);
  });

  it("cancels the run BEFORE aborting, so the rejection lands on a dead run", () => {
    const handler = HOST.slice(
      HOST.indexOf("function discardUploadingTake()"),
      HOST.indexOf("/** The dialog's destructive answer"),
    );
    expect(handler.indexOf("uploadCancelRef.current?.()")).toBeLessThan(
      handler.indexOf("uploadAbortRef.current?.abort()"),
    );
  });

  it("a discard never reaches the effect's outcome branches at all", () => {
    // It parks instead of returning a value. If the cancel guarantee ever
    // broke, the effect would quietly do nothing rather than raise an error
    // panel — with a retry button — over a take deliberately thrown away.
    const wrapper = HOST.slice(
      HOST.indexOf("async function uploadForProcessing"),
      HOST.indexOf("/** Per-recording context"),
    );
    expect(wrapper).toContain('if (result.kind !== "discarded") return result;');
    expect(wrapper).toContain("return new Promise(() => undefined);");
  });

  it("NEVER aborts from the effect cleanup", () => {
    // An unmount or a dependency change must not throw a take away. The
    // cleanup has always been `active = false` — a silent result, not a
    // cancelled upload — and adding an abort there would discard takes on a
    // re-render, which is the opposite of this feature.
    const effect = HOST.slice(
      HOST.indexOf("// seam ③ — fire the synchronous upload once"),
      HOST.indexOf("}, [state, blob, context, dispatch, cancelMic, retryNonce, userId]);"),
    );
    // COMMENTS STRIPPED FIRST. The cleanup's own comment says the word
    // "abort" — it is there to explain why there ISN'T one — and an assertion
    // that reads prose is not reading the code.
    const cleanup = effect
      .slice(effect.lastIndexOf("return () => {"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(cleanup).toContain("active = false");
    expect(cleanup).not.toContain("abort");
  });

  it("reuses the existing lab_processing → lab_recording transition", () => {
    // The 422 lane already goes exactly where a discard needs to go. A second
    // door into the same room is a second thing to keep in step.
    const handler = HOST.slice(
      HOST.indexOf("function discardUploadingTake()"),
      HOST.indexOf("/** The dialog's destructive answer"),
    );
    expect(handler).toContain('dispatch("upload_rejected")');
    expect(handler).toContain("uploadAbortRef.current?.abort()");
    // The discarded take must not advance the arc or leave its blob behind to
    // be re-uploaded by the next entry into processing.
    expect(handler).toContain("pendingCarryRef.current = null");
    expect(handler).toContain("setBlob(null)");
    // ...and the mic does not open by itself.
    expect(handler).not.toContain("mic.start()");
  });

  it("does not tell someone to 'keep recording' when nothing is recording", () => {
    // One dialog, two lanes. Title, body and confirm are shared because they
    // are true on both; the cancel label is only true where the mic is live.
    expect(DIALOG).toMatch(/lane === "recording" \? "Keep recording" : "Cancel"/);
    expect(DIALOG).toContain("Discard this take?");
    expect(DIALOG).toContain("This recording has not been saved.");
    expect(DIALOG).toContain("Discard take");
    // And the host still routes both lanes into it.
    expect(HOST).toContain('setDiscardConfirm("recording")');
    expect(HOST).toContain('setDiscardConfirm("upload")');
  });
});
