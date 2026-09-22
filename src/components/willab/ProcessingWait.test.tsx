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

  it("still renders the one waiting screen, with its percentage", async () => {
    /* A DOCUMENT-PHASE REPORT NOW LANDS IN THE DOCUMENT SLICE (founder
       2026-09-22). It used to print straight through as "62%", which put a
       document two thirds of the way along BELOW where the analysis phase had
       already stood. The slices exist so the bar only ever moves forward:
       62% of the document phase is 96% of the wait. */
    const text = await render({
      phase: "document",
      progress: { stage: "document_assembly", percent: 62 },
    });
    expect(text).toContain(DOCUMENT);
    expect(text).toContain("96%");
  });

  it("says nothing before the analysis phase has reported anything", async () => {
    // Unchanged where it still holds: the analysis phase has no clock of its
    // own, so before the first report there is genuinely nothing to say.
    expect(await render({ phase: "analysis", progress: null })).toContain("…");
  });

  it("speaks in the document phase even when nothing was ever reported", async () => {
    /* THIS REVERSES THE 2026-09-19 RULING, on the founder's word, and the
       line it replaces read "invents no percentage when the backend exposes
       none". That rule was right while the bar claimed to measure WORK. The
       founder has since defined what it measures — the WAIT, ending when the
       text can be read — and this phase has a real deadline of its own, so it
       is not silent about it. `waitProgress.ts` carries the full argument. */
    const text = await render({ phase: "document", progress: null });
    expect(text).toContain("90%");
    expect(text).not.toContain("…");
  });

  it("hands over at the ceiling rather than collapsing or falling back", async () => {
    /* FOUNDER 2026-09-19: "there is no continuity there and it feels like
       it's stale". It was not stale — the worker had finished in seventeen
       seconds. The analysis phase reports a percent and climbs, the document
       phase is seeded `percent: null`, and a null draws as "…" on an empty
       rail. So the bar filled, collapsed to nothing, and the text then
       appeared from nowhere. This is that exact handover — and the document
       phase now starts ABOVE where analysis left off rather than holding
       its number. */
    await render({
      phase: "analysis",
      progress: { stage: "transcribing", percent: 62 },
    });
    const handover = await render({ phase: "document", progress: null });
    expect(handover).toContain("90%");
    expect(handover).not.toContain("…");
  });

  it("never shows a full bar, because a full bar IS the ideal text", async () => {
    /* FOUNDER 2026-09-22: "100% means instant switch to the ideal text". So
       the last point is reserved for settlement and nothing else can print
       it — the speaker never sees a finished bar and then waits behind it. */
    const text = await render({
      phase: "document",
      progress: { stage: "document_assembly", percent: 100 },
    });
    expect(text).toContain("99%");
    expect(text).not.toContain("100%");
  });

  it("does not rewind the label when the analysis phase hands over", async () => {
    /* THE STALENESS, EXACTLY (founder 2026-09-22: "the building text is
       simply stale there").

       The pipeline reports its real stages and the wait walks all the way to
       "Finding your anchors". The handover then rewrites the marker
       `{stage: "document_assembly"}` — index 2 — and the screen stepped BACK
       two labels and stopped there for the rest of the phase. A screen that
       un-says what it just said reads as the machine starting over. */
    await render({
      phase: "analysis",
      progress: { stage: "speaking_anchors", percent: 95 },
    });
    const handover = await render({
      phase: "document",
      progress: { stage: "document_assembly", percent: null },
    });
    expect(handover).toContain(ANCHORS);
    expect(handover).not.toContain(DOCUMENT);
  });

  it("does not rewind within the analysis phase either", async () => {
    // Same rule, one phase earlier: a stage the backend re-reports out of
    // order must not walk the speaker backwards.
    await render({
      phase: "analysis",
      progress: { stage: "speaking_anchors", percent: 95 },
    });
    const backwards = await render({
      phase: "analysis",
      progress: { stage: "transcribing", percent: 95 },
    });
    expect(backwards).toContain(ANCHORS);
    expect(backwards).not.toContain(TRANSCRIBING);
  });

  it("names the stage to assistive tech too, not just on screen", async () => {
    await render({ phase: "document", progress: null });
    const bar = host.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute("aria-label")).toBe(DOCUMENT);
    expect(bar?.getAttribute("aria-label")).not.toBe(RECORDING);
  });
});
