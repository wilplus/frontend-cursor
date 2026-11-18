// @vitest-environment jsdom
/*
STORY    As a speaker waiting for a Take, I want the processing state to stay
         calm and explicit, so I know the recording is safe while analysis runs.
OUTCOME  O1  The processing wait keeps the approved progress and close copy.
PROVES   O1 -> the rendered wait shows the three-dot mark, 1%, and safe-close line.
*/
import { act, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import ProcessingWait from "./ProcessingWait";

let host: HTMLDivElement;
let root: Root;

function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(node));
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  document.documentElement.lang = "en";
});

describe("the Take processing wait", () => {
  it("keeps the three-dot mark, starts at 1%, and explains the safe close", () => {
    mount(
      createElement(ProcessingWait, {
        progress: null,
        cycleStartedAt: 1,
      }),
    );

    expect(host.querySelectorAll("[data-voice-mark] [data-loading-dot]")).toHaveLength(3);
    expect(host.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("1");
    expect(host.textContent).toContain(
      "Usually about a minute. You can close this screen; processing will continue in the background.",
    );
  });

  it("uses the active document language for the new wait copy", () => {
    document.documentElement.lang = "pl";
    mount(
      createElement(ProcessingWait, {
        progress: null,
        cycleStartedAt: 1,
      }),
    );

    expect(host.textContent).toContain(
      "Zwykle trwa to około minuty. Możesz zamknąć ten ekran — przetwarzanie będzie trwało w tle.",
    );
  });
});
