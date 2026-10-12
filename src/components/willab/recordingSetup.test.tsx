// @vitest-environment jsdom
/* The setup asks topic, length, slides, then starts (founder 2026-10-12). */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("./PresentationInput", () => ({ default: () => null }));
vi.mock("@/components/tokens/RecordPriceNote", () => ({ default: () => null }));
vi.mock("@/services/api/recordingConfig", () => ({
  fetchRecordingConfig: () => new Promise(() => {}),
}));

import RecordingSetup from "./RecordingSetup";

it("asks topic, length, slides, then starts", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const onSubmit = vi.fn();
  act(() =>
    createRoot(host).render(
      createElement(RecordingSetup, { contextArcId: null, preloadDeck: null, onSubmit })
    )
  );
  const input = host.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "My pitch");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const next = () => act(() => [...host.querySelectorAll("button")].at(-1)!.click());

  next();
  expect(host.textContent).toContain("How long should it run?");
  next();
  expect(host.textContent).toContain("Have slides to go with it?");
  expect(host.textContent).not.toContain("Three is where it really lands");
  next();
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ topic: "My pitch" });
});
