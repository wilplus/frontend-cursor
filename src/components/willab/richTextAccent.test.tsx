// @vitest-environment jsdom
/* Helper words are orange in the headline only (founder 2026-09-26): the
   running text draws them in the paragraph's own colour. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RichText } from "./RichText";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const TEXT = "What you {{orange:gotta do}} is simple.";

describe("RichText accent", () => {
  it("paints orange words in the accent by default", async () => {
    await act(async () => root.render(createElement(RichText, { text: TEXT })));
    expect(container.querySelector(".text-primary")?.textContent).toContain("gotta");
  });

  it("accent={false} keeps the words but not the orange, tint included", async () => {
    await act(async () =>
      root.render(createElement(RichText, { text: TEXT, accent: false, tint: [[0, 4]] })),
    );
    expect(container.querySelector(".text-primary")).toBeNull();
    expect(container.textContent).toContain("gotta do");
  });

  it("tintClass=\"italic\" marks the helper words italic in the paragraph's own colour", async () => {
    await act(async () =>
      root.render(
        createElement(RichText, {
          text: "We think the timing matters here.",
          accent: false,
          tint: [[9, 27]],
          tintClass: "italic",
        }),
      ),
    );
    expect(container.querySelector(".text-primary")).toBeNull();
    expect(container.querySelector(".italic")?.textContent).toBe("the timing matters");
  });
});
