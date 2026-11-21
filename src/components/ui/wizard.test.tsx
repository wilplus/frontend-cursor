// @vitest-environment jsdom
/*
STORY    As a speaker, I want the onboarding progress and close control in one
         centred header row, so that I can see my position and leave easily.
OUTCOME
  O1  The progress indicator is centred against the header row and the
      outlined close control stays in that same row.
PROVES   O1 -> "keeps the centred progress and outlined close control in one row"
WHY      The shared onboarding chrome must stay aligned across the recording
         and Life Panel setup flows.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WizardCancel, WizardProgress } from "./wizard";

describe("wizard progress header", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("keeps the centred progress and outlined close control in one row", () => {
    const onClose = vi.fn();

    act(() => {
      root.render(
        createElement(WizardProgress, {
          count: 3,
          current: 1,
          trailing: createElement(WizardCancel, { onClick: onClose, ariaLabel: "Close" }),
        }),
      );
    });

    const header = host.querySelector('[aria-label="Setup progress"]')!;
    const progress = header.querySelector("[data-wizard-progress]")!;
    const close = header.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!;

    expect(progress.className).toContain("left-1/2");
    expect(close.className).toContain("border");
    expect(close.closest('[aria-label="Setup progress"]')).toBe(header);

    act(() => close.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
