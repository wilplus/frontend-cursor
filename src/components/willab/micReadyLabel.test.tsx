// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  "Getting your mic ready" AS SMALL GREY TEXT UNDER THE MARK (build plan     */
/*  D-RC-5; recording lock §The flow 2; the prototype's renderMic).           */
/*                                                                            */
/*  Until the founder signed every word a locked prototype shows (Q-B4 A,     */
/*  decisions log N62/N63, 2026-10-07) the label was read only by screen      */
/*  readers. Now, on the recording's mic wait only, it shows 16px under the   */
/*  64px mark in 15px muted text; every other LoadingState keeps its sr-only  */
/*  label.                                                                    */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RECORDING_COPY } from "./recordingCopy";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the words", () => {
  it("are the prototype's, signed by Q-B4 A", () => {
    expect(RECORDING_COPY.micReady).toBe("Getting your mic ready");
  });
});
