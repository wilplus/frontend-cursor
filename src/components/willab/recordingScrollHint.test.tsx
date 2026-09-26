// @vitest-environment jsdom
/* The first-take scroll hint (founder 2026-09-26): an animated guide to
   the next slide, gone after the first move. */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdfSlides", () => ({
  PdfPage: () => null,
  MockPresentationSlide: () => null,
  SlideRender: () => null,
}));

import RecordingRoadmap from "./RecordingRoadmap";

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

const SLIDES = [0, 1, 2].map((i) => ({ title: `Slide ${i + 1}`, body: "" })) as never[];

function Harness() {
  const [current, setCurrent] = useState(0);
  return createElement(RecordingRoadmap, {
    slides: SLIDES,
    presentationRef: null,
    currentSlide: current,
    roots: [],
    onSlideChange: setCurrent,
  });
}

describe("the first-take scroll hint", () => {
  it("shows animated, then goes after the first move and stays gone", () => {
    act(() => root.render(createElement(Harness)));
    const hint = () => host.querySelectorAll('button[aria-label="Next slide"]');
    expect(hint().length).toBeGreaterThan(0);
    expect(host.innerHTML).toContain("motion-safe:animate-bounce");
    act(() => (hint()[0] as HTMLButtonElement).click());
    // Slide 2 of 3 is not the last, and still no hint: it did its job.
    expect(hint().length).toBe(0);
  });
});
