// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE WAITING SCREEN MUST NOT NAME WORK THAT IS NOT RUNNING                  */
/*  (founder 2026-09-16, the last of the three record/retake dead-ends)        */
/*                                                                            */
/*  The job marker has always carried `phase`. The screen never read it, so    */
/*  every document-phase wait whose stage this file does not recognise — a     */
/*  resumed job, a reopened overlay, a marker written with `progress: null` —  */
/*  fell through `stageIndex`'s default to index 0 and announced "Processing   */
/*  your recording". The document phase re-bakes an existing document and      */
/*  never touches audio, so that sentence was not a rough edge: it told the    */
/*  speaker their recording was being worked on when nothing was.             */
/*                                                                            */
/*  Still ONE waiting screen (founder 2026-08-11). The labels all come from    */
/*  the same approved list; the phase only decides which of them can be        */
/*  reached.                                                                  */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ProcessingWait, { PROCESSING_STAGES } from "./ProcessingWait";

const RECORDING = PROCESSING_STAGES[0]; // "Processing your recording"
const TRANSCRIBING = PROCESSING_STAGES[1]; // "Transcribing your take"
const DOCUMENT = PROCESSING_STAGES[2]; // "Building your Ideal Text"
const ANCHORS = PROCESSING_STAGES[4]; // "Finding your anchors"

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

async function render(props: Parameters<typeof ProcessingWait>[0]) {
  await act(async () => {
    root.render(createElement(ProcessingWait, props));
  });
  return host.textContent ?? "";
}

describe("ProcessingWait — the phase decides which labels are reachable", () => {
  it("a document phase with no reported stage does not claim the recording is being processed", async () => {
    // THE BUG, exactly: this is what a resumed document job looked like.
    const text = await render({ phase: "document", progress: null });
    expect(text).not.toContain(RECORDING);
    expect(text).not.toContain(TRANSCRIBING);
    expect(text).toContain(DOCUMENT);
  });

  it("an unrecognised stage during the document phase falls to the document label, not to audio", async () => {
    const text = await render({
      phase: "document",
      progress: { stage: "some_stage_this_file_has_never_heard_of", percent: null },
    });
    expect(text).not.toContain(RECORDING);
    expect(text).toContain(DOCUMENT);
  });

  it("FLOORS, never overrides: a document phase that reaches a later stage keeps it", async () => {
    // The point of a floor rather than a fixed label — the document phase does
    // genuinely progress, and pinning it would replace one lie with another.
    const text = await render({
      phase: "document",
      progress: { stage: "finalizing", percent: null },
    });
    expect(text).toContain(ANCHORS);
    expect(text).not.toContain(DOCUMENT);
  });

  it("leaves the analysis phase exactly as it was", async () => {
    // The take really is being processed here, so the label is true and this
    // change must not touch it. Both the default and the explicit value.
    expect(await render({ progress: null })).toContain(RECORDING);
    expect(await render({ phase: "analysis", progress: null })).toContain(
      RECORDING,
    );
    expect(
      await render({
        phase: "analysis",
        progress: { stage: "transcribing", percent: 40 },
      }),
    ).toContain(TRANSCRIBING);
  });

  it("still renders the one waiting screen, with its real percentage", async () => {
    const text = await render({
      phase: "document",
      progress: { stage: "document_assembly", percent: 62 },
    });
    expect(text).toContain(DOCUMENT);
    expect(text).toContain("62%");
  });

  it("invents no percentage when the backend has never exposed one", async () => {
    // A FRESH wait — nothing reported yet, so there is nothing to say, and
    // "…" is the honest answer. Split out of the case above because that one
    // now re-renders the SAME component: once a real percent has arrived it
    // is held (below), which is a different rule, not a broken one.
    expect(await render({ phase: "document", progress: null })).toContain("…");
  });

  it("holds the last real percentage instead of falling back to none", async () => {
    /* FOUNDER 2026-09-19: "there is no continuity there and it feels like
       it's stale". It was not stale — the worker had finished in seventeen
       seconds. The analysis phase reports a percent and climbs, the document
       phase is seeded `percent: null`, and a null draws as "…" on an empty
       rail. So the bar filled, collapsed to nothing, and the text then
       appeared from nowhere. This is that exact handover. */
    await render({
      phase: "analysis",
      progress: { stage: "transcribing", percent: 62 },
    });
    const handover = await render({ phase: "document", progress: null });
    expect(handover).toContain("62%");
    expect(handover).not.toContain("…");
  });

  it("names the stage to assistive tech too, not just on screen", async () => {
    await render({ phase: "document", progress: null });
    const bar = host.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute("aria-label")).toBe(DOCUMENT);
    expect(bar?.getAttribute("aria-label")).not.toBe(RECORDING);
  });
});
