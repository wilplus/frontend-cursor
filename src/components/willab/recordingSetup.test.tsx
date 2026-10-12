// @vitest-environment jsdom
/* The recording setup asks only topic, length and slides (founder
   2026-10-12): audience, call to action and additional info are hidden. */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("./PresentationInput", () => ({ default: () => null }));
vi.mock("./ContextDocumentInput", () => ({ default: () => null }));
vi.mock("@/components/tokens/RecordPriceNote", () => ({ default: () => null }));
vi.mock("@/services/api/recordingConfig", () => ({
  fetchRecordingConfig: () => new Promise(() => {}),
}));

import RecordingSetup from "./RecordingSetup";

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

function typeTopic(value: string) {
  const input = host.querySelector("input") as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function clickPrimary() {
  const label = /^(Next|Skip for now|Start recording)$/;
  const button = [...host.querySelectorAll("button")].find((b) =>
    label.test(b.textContent?.trim() ?? "")
  )!;
  act(() => button.click());
}

it("asks topic, length, slides, then starts with the topic only", () => {
  const onSubmit = vi.fn();
  act(() =>
    root.render(
      createElement(RecordingSetup, { contextArcId: null, preloadDeck: null, onSubmit })
    )
  );
  const seen: string[] = [];
  expect(host.textContent).toContain("What is the topic?");
  typeTopic("My pitch");
  for (let i = 0; i < 3 && onSubmit.mock.calls.length === 0; i++) {
    clickPrimary();
    seen.push(host.textContent ?? "");
  }
  expect(seen[0]).toContain("How long should it run?");
  expect(seen[1]).toContain("Have slides to go with it?");
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    topic: "My pitch",
    audience: "",
    strategicContext: undefined,
  });
  const all = seen.join(" ");
  expect(all).not.toContain("Who's the audience?");
  expect(all).not.toContain("What do you want your audience to do");
  expect(all).not.toContain("Additional sources");
});
