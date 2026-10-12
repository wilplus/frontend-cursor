// @vitest-environment jsdom
/* The header's one ⋯ (founder 2026-09-26, Ideal Text redesign B): every
   secondary action in one menu, Save the ideal text included. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api/saveIdealText", () => ({
  saveIdealText: vi.fn(async () => ({ kind: "saved" })),
}));

import IdealTextMenu from "./IdealTextMenu";

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

function render(props: Record<string, unknown>) {
  act(() => {
    root.render(
      createElement(IdealTextMenu, {
        arcId: "arc-1",
        saved: false,
        onSaved: () => undefined,
        onCopy: () => undefined,
        copied: false,
        ...props,
      } as never),
    );
  });
}

function openMenu() {
  act(() => (host.querySelector('button[aria-label="More"]') as HTMLButtonElement).click());
}

describe("IdealTextMenu", () => {

  it("reads as the design's menu: Presentation Mode, Export, History, Copy the text, Save the ideal text (D-IT-2)", () => {
    render({ onPresent: vi.fn(), onExport: vi.fn(), onHistory: vi.fn() });
    openMenu();
    const labels = [...host.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent);
    expect(labels).toEqual([
      "Presentation Mode",
      "Export",
      "History",
      "Copy the text",
      "Save the ideal text",
    ]);
  });
});
