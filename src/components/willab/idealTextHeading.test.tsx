// @vitest-environment jsdom
/* The Ideal Text header shows the project's whole name (Ideal Text Final
   Screens; build plan D-IT-2): no ten-character cut and fade, an ellipsis
   only when the name truly does not fit. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import IdealTextHeading from "./IdealTextHeading";

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

function title(name: string | null) {
  act(() => root.render(createElement(IdealTextHeading, { title: name, status: null })));
  return host.querySelector("span")!;
}

describe("the Ideal Text header's name", () => {
  it("shows a long name whole, with no width cap and no fade", () => {
    const span = title("Garage pitch to the regional board");
    expect(span.textContent).toBe("Garage pitch to the regional board");
    expect(span.className).not.toMatch(/max-w-\[10ch\]|mask-image/);
  });

  it("ellipsizes only on real overflow: it may shrink, and truncate does the rest", () => {
    const cls = title("Garage pitch").className.split(" ");
    expect(cls).toEqual(expect.arrayContaining(["block", "min-w-0", "truncate"]));
    expect(cls).not.toContain("shrink-0");
  });

  it("keeps the generic name when the project has none", () => {
    expect(title(null).textContent).toBe("Your ideal text");
  });
});
