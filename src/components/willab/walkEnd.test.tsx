// @vitest-environment jsdom
/*
STORY    As a speaker, I want a short "saved" line when a sheet finishes, and an
         end card with the next Take after the last moment, so that I know I am
         done and what is next.
OUTCOME
  O1  After the last moment the card says so, offers the host's own next step
      ("Record Take 2") and Back closes it. Never-3: the walk always ends on
      the way to the next Take, never on a dead end.
  O2  A finished sheet shows its "saved" line, which goes by itself after a
      moment and tells the host it has gone.
PROVES   O1 -> "after the last moment, offers the host's next step and the way back"
         O2 -> "shows the saved line, then lets it go on its own"
WHY      Founder 2026-09-26: sheets used to close in silence.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalkEndLayer } from "./WalkEnd";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("WalkEndLayer", () => {

  it("after the last moment, offers the host's next step and the way back", () => {
    const onCloseEndCard = vi.fn();
    act(() =>
      root.render(
        createElement(WalkEndLayer, {
          endCard: true,
          renderNextStep: () => createElement("button", null, "Record Take 2"),
          onCloseEndCard,
          toast: null,
          onToastGone: () => undefined,
        }),
      ),
    );
    expect(host.textContent).toContain("That's every moment for this Take");
    expect(host.textContent).toContain("Record Take 2");
    const back = [...host.querySelectorAll("button")].find((b) => b.textContent === "Back to the text");
    act(() => back!.click());
    expect(onCloseEndCard).toHaveBeenCalled();
  });

  it("shows the saved line, then lets it go on its own", () => {
    const onToastGone = vi.fn();
    const layer = (toast: string | null) =>
      createElement(WalkEndLayer, {
        endCard: false,
        onCloseEndCard: () => undefined,
        toast,
        onToastGone,
      });
    act(() => root.render(layer("Helper words saved")));
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Helper words saved");

    // Still up a moment later; gone once its time is over.
    act(() => vi.advanceTimersByTime(1000));
    expect(onToastGone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(onToastGone).toHaveBeenCalledTimes(1);

    // The host clears it, and nothing is left on the page.
    act(() => root.render(layer(null)));
    expect(host.querySelector('[role="status"]')).toBeNull();
  });
});
