// @vitest-environment jsdom
/* The walk's closing signals (founder 2026-09-26): a short "saved" line when
   a sheet finishes on its own, and the card after the last moment. */
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
  it("says the save for a moment, then clears", () => {
    const onToastGone = vi.fn();
    act(() =>
      root.render(
        createElement(WalkEndLayer, {
          endCard: false,
          onCloseEndCard: () => undefined,
          toast: "Helper words saved",
          onToastGone,
        }),
      ),
    );
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Helper words saved");
    act(() => vi.advanceTimersByTime(1800));
    expect(onToastGone).toHaveBeenCalledTimes(1);
  });

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
});
