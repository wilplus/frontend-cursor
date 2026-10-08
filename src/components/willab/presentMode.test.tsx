// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  PRESENTATION MODE MATCHES THE FRAME (build plan D-IT-9; Final Screens L5  */
/*  present(); contract 20; founder 2026-10-07, Q-B14 A (2)).                 */
/*                                                                            */
/*  A dark screen with no slide-dot rail. Paragraph text runs 17px rising to  */
/*  20px. The headline is bold and orange, with the same words italic inside */
/*  the paragraph. Only the ✕.                                                */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdfSlides", () => ({
  useDeckPageCount: () => null,
  PdfPage: () => null,
  MockPresentationSlide: ({ title }: { title: string }) => createElement("div", { "data-mock-slide": "" }, title),
  SlideRender: () => null,
}));

import PresentMode from "./PresentMode";

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

const TEXT = [
  "We started this in a garage with nothing but a borrowed mic.",
  "We think the timing matters, because the window closes once the incumbents catch up with pricing.",
  "So today I'm asking for approval on the hiring plan.",
].join("\n\n");

function show(props: Record<string, unknown> = {}) {
  act(() => {
    root.render(
      createElement(PresentMode, {
        text: TEXT,
        pieces: [
          { pieceKey: 0, slideIndex: 0, rootPhrase: "", rootType: "neutral" },
          { pieceKey: 1, slideIndex: 1, rootPhrase: "the timing matters", rootType: "flagship" },
          { pieceKey: 2, slideIndex: 2, rootPhrase: "", rootType: "neutral" },
        ],
        presentationRef: null,
        onClose: () => undefined,
        ...props,
      } as never),
    );
  });
}

describe("Presentation Mode", () => {
  it("is a dark screen", () => {
    show();
    const screen = host.querySelector("[data-present-mode]") as HTMLElement;
    const cls = screen.className.split(" ");
    expect(cls).toContain("dark");
    expect(cls).toContain("bg-background");
    expect(cls).toContain("text-foreground");
    expect(cls).toContain("fixed");
  });

  it("has no slide-dot rail, no arrows and no counter", () => {
    show();
    expect(host.querySelector("[aria-hidden='true'].pointer-events-none")).toBeNull();
    expect(host.querySelector(".bg-primary.h-5")).toBeNull();
    expect(host.textContent).not.toMatch(/\d+ of \d+/);
  });

  it("shows only the ✕", () => {
    show();
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute("aria-label")).toBe("Exit present mode");
    // The app's one X, only placed (D-RC-6).
    expect(buttons[0].className).toContain("rounded-full border border-border");
  });

  it("runs the paragraphs at 17px rising to 20px", () => {
    show();
    const text = host.querySelector("[data-present-text]") as HTMLElement;
    const cls = text.className.split(" ");
    expect(cls).toContain("text-[17px]");
    expect(cls).toContain("md:text-[20px]");
    expect(host.textContent).toContain("borrowed mic");
  });

  it("draws the headline bold and orange, with its words italic inside the paragraph", () => {
    show();
    const headlines = [...host.querySelectorAll("[data-present-headline]")];
    expect(headlines.map((h) => h.textContent)).toEqual(["the timing matters"]);
    const cls = headlines[0].className.split(" ");
    expect(cls).toContain("font-bold");
    expect(cls).toContain("text-primary");
    const italic = [...host.querySelectorAll("[data-present-text] .italic, [data-present-text] i, [data-present-text] em")]
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    expect(italic).toEqual(["the timing matters"]);
    // The italic words are not orange (clause 20: the headline is the only orange).
    const marked = host.querySelector("[data-present-text] .italic") as HTMLElement;
    expect(marked.className).not.toContain("text-primary");
  });
});
