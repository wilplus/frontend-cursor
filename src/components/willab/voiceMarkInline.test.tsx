// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VoiceMark } from "./LoadingState";

describe("VoiceMark inline", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders a 16px span mark inside a button", () => {
    act(() => {
      root.render(createElement("button", null, createElement(VoiceMark, { size: 16, className: "mr-2" })));
    });
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    const mark = button!.querySelector("[data-voice-mark]");
    expect(mark).not.toBeNull();
    expect(mark!.tagName).toBe("SPAN");
    expect(mark!.getAttribute("data-voice-mark")).toBe("");
    expect(mark!.getAttribute("aria-hidden")).toBe("true");
    expect((mark as HTMLElement).style.width).toBe("16px");
    expect(mark!.classList.contains("mr-2")).toBe(true);
    expect(button!.querySelector("div")).toBeNull();
  });
});
