// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  ONE CLOSE BUTTON, APP-WIDE (build plan D-RC-6; founder 2026-10-07,         */
/*  Q-B14 A (1): "keep the app's one small grey X everywhere").               */
/*                                                                            */
/*  OverlayCloseButton stays the one X: the recording screens' header, the    */
/*  text page's header and the Feedback walk's overlay all draw it unchanged, */
/*  and the ⋯ beside it on the text page wears the same style. A caller may   */
/*  place it; none may restyle it.                                            */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api/saveIdealText", () => ({
  saveIdealText: vi.fn(async () => ({ kind: "saved" })),
}));

import OverlayCloseButton, { OVERLAY_ICON_BUTTON_CLASS, OVERLAY_ICON_CLASS } from "./OverlayCloseButton";
import IdealTextMenu from "./IdealTextMenu";
import WalkOverlay from "./walk/WalkOverlay";

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

const STYLE = ["h-7", "w-7", "rounded-full", "border", "border-border", "text-muted-foreground", "hover:bg-muted"];

function classesOf(selector: string): string[] {
  return (host.querySelector(selector) as HTMLElement).className.split(/\s+/);
}

describe("the one style", () => {
  it("is a 28px bordered grey circle with a 16px icon", () => {
    for (const c of STYLE) expect(OVERLAY_ICON_BUTTON_CLASS.split(" ")).toContain(c);
    expect(OVERLAY_ICON_CLASS).toBe("h-4 w-4");
  });

  it("OverlayCloseButton wears it, and a caller may only place it", () => {
    act(() => root.render(createElement(OverlayCloseButton, { onClick: () => undefined, className: "ml-3" })));
    const classes = classesOf('button[aria-label="Close"]');
    for (const c of STYLE) expect(classes).toContain(c);
    expect(classes).toContain("ml-3");
    expect(host.querySelector("svg")?.getAttribute("class")).toContain("h-4 w-4");
  });

  it("the text page's ⋯ beside the ✕ wears the same style", () => {
    act(() =>
      root.render(
        createElement(IdealTextMenu, {
          arcId: "arc-1",
          saved: false,
          onSaved: () => undefined,
          onCopy: () => undefined,
          copied: false,
        } as never),
      ),
    );
    const classes = classesOf('button[aria-label="More"]');
    expect(classes.sort()).toEqual(OVERLAY_ICON_BUTTON_CLASS.split(" ").sort());
    expect(host.querySelector('button[aria-label="More"] svg')?.getAttribute("class")).toContain("h-4 w-4");
  });

  it("the Feedback walk's overlay draws the same X, only placed", () => {
    act(() => root.render(createElement(WalkOverlay, { onClose: () => undefined, testId: "ov" }, "body")));
    const classes = classesOf('button[aria-label="Close"]');
    for (const c of STYLE) expect(classes).toContain(c);
    // No size, border or fill of its own: the prototype's 30px filled circle is not built.
    expect(classes.some((c) => /^[hw]-\[/.test(c))).toBe(false);
    expect(classes).not.toContain("border-transparent");
    expect(classes).not.toContain("bg-muted");
  });
});

describe("where it is drawn", () => {
  it("the recording screens' header and the text page's header draw it plain", () => {
    const lab = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");
    expect(lab).toMatch(/<OverlayCloseButton onClick=\{handleClose\} \/>/);
    const ideal = readFileSync("src/components/willab/IdealTextOverlay.tsx", "utf8");
    expect(ideal).toMatch(/<OverlayCloseButton onClick=\{onClose\} \/>/);
    const mirror = readFileSync("src/app/dev/recording/page.tsx", "utf8");
    expect(mirror).toMatch(/<OverlayCloseButton onClick=\{\(\) => \{\}\} \/>/);
  });

  it("no willab screen restyles it: a className it passes only places it", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const files = execSync("grep -rl --include=*.tsx '<OverlayCloseButton' src || true", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    const restyled: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/<OverlayCloseButton[\s\S]*?\/>/g)) {
        const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(m[0]);
        const classes = (cls?.[1] ?? cls?.[2] ?? "").split(/\s+/).filter(Boolean);
        const bad = classes.filter((c) =>
          /^(h|w|size)-|^border(-(?!border))?|^bg-(?!background)|^text-(?!muted)|^rounded|^ring/.test(c),
        );
        if (bad.length) restyled.push(`${file}: ${bad.join(" ")}`);
      }
    }
    expect(restyled, restyled.join("\n")).toEqual([]);
  });

});
