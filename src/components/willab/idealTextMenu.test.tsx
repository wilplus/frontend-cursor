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
  it("is closed until the ⋯ is tapped", () => {
    render({ onPresent: vi.fn(), onExport: vi.fn() });
    expect(host.querySelector('[role="menu"]')).toBeNull();
    openMenu();
    const labels = [...host.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent);
    expect(labels).toEqual([
      "Presentation Mode",
      "Export",
      "Copy the text",
      "Save the ideal text",
    ]);
  });

  it("withholds what this mount does not have", () => {
    render({ saved: null });
    openMenu();
    const labels = [...host.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent);
    expect(labels).toEqual(["Copy the text"]);
  });

  it("offers Version history only when there are revisions", () => {
    render({ onHistory: vi.fn() });
    openMenu();
    expect(host.textContent).toContain("Version history");
  });

  it("says the fact once saved instead of offering again", () => {
    render({ saved: true });
    openMenu();
    expect(host.textContent).toContain("Saved. This is your script.");
    expect(host.textContent).not.toContain("Save the ideal text");
  });

  it("runs an action and closes", () => {
    const onPresent = vi.fn();
    render({ onPresent });
    openMenu();
    act(() => (host.querySelector('[aria-label="Use Presentation Mode"]') as HTMLButtonElement).click());
    expect(onPresent).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="menu"]')).toBeNull();
  });
});
