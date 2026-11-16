// @vitest-environment jsdom
/*
STORY    As a speaker, I want one compact view of every slide range I have
         practised, so that I can see where to continue without confusing
         effort with delivery quality.
OUTCOME  O1 Only the latest chunk shows until I ask for earlier chunks.
         O2 One chunk reserves no empty history-control space and both
         destinations open for that chunk.
PROVES   O1 -> "shows only the latest chunk until earlier chunks are requested"
         O2 -> "omits the history control for one chunk and opens the latest destinations"
WHY      Founder-approved Feedback Walk handoff, 2026-11-16.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeedbackWalkCard from "./FeedbackWalkCard";
import type { PracticeChunk } from "@/services/api/trainings";

const chunks: PracticeChunk[] = [
  { startSlide: 1, endSlide: 5, attempts: 10, deliveryLabel: "Not yet there", latestSessionId: "a" },
  { startSlide: 6, endSlide: 12, attempts: 12, deliveryLabel: "Good", latestSessionId: "b" },
  { startSlide: 25, endSlide: 30, attempts: 1, deliveryLabel: "Strong delivery", latestSessionId: "c" },
];

let root: Root;
let host: HTMLDivElement;
const feedback = vi.fn();
const ideal = vi.fn();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  feedback.mockClear();
  ideal.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function draw(value = chunks) {
  act(() => root.render(createElement(FeedbackWalkCard, {
    title: "Board meeting",
    progress: 74,
    chunks: value,
    onFeedback: feedback,
    onIdealText: ideal,
  })));
}

describe("Feedback Walk practice history", () => {
  it("shows only the latest chunk until earlier chunks are requested", () => {
    draw();
    expect(host.textContent).toContain("74%");
    expect(host.textContent).toContain("Slides 25-30");
    expect(host.textContent).not.toContain("Slides 1-5");
    const toggle = [...host.querySelectorAll("button")].find((button) => button.textContent === "Show 2 earlier chunks")!;
    act(() => toggle.click());
    expect(host.textContent).toContain("Slides 1-5");
    expect(host.textContent).toContain("12 attempts");
    expect(host.textContent).toContain("Hide earlier chunks");
    const first = host.querySelectorAll<HTMLElement>("[data-practice-chunk]")[0];
    act(() => first.click());
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Feedback"))!.click());
    expect(feedback).toHaveBeenCalledWith(chunks[0]);
  });

  it("omits the history control for one chunk and opens the latest destinations", () => {
    draw([chunks[2]]);
    expect(host.textContent).not.toContain("earlier chunks");
    const buttons = [...host.querySelectorAll("button")];
    act(() => buttons.find((button) => button.textContent?.includes("Feedback"))!.click());
    act(() => buttons.find((button) => button.textContent?.includes("Ideal text"))!.click());
    expect(feedback).toHaveBeenCalledWith(chunks[2]);
    expect(ideal).toHaveBeenCalledWith(chunks[2]);
  });
});
