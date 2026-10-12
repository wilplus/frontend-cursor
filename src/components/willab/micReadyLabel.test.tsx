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
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import LoadingState from "./LoadingState";
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

describe("LoadingState with a visible label", () => {

  it("keeps every other wait as it was: the mark and an sr-only label", () => {
    act(() => {
      root.render(createElement(LoadingState, { placement: "surface", label: "Loading" }));
    });
    expect(host.querySelector("[data-loading-label]")).toBeNull();
    const sr = host.querySelector(".sr-only") as HTMLElement;
    expect(sr.textContent).toBe("Loading");
    expect(sr.getAttribute("role")).toBe("status");
  });
});

describe("only the recording's mic wait shows its label", () => {

  it("no other LoadingState in the product shows its label", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const hits = execSync(
      "grep -rl --include=*.tsx 'labelVisible' src | grep -v '\\.test\\.' || true",
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .sort();
    expect(hits).toEqual([
      "src/components/willab/LabOverlay.tsx",
      "src/components/willab/LoadingState.tsx",
    ]);
  });
});
