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
import ProcessingWait, {  } from "./ProcessingWait"; // "Finding your anchors"

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
});
