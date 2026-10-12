// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  A FAILED SLIDE PREVIEW IS RECOVERABLE                                      */
/*  (reported from real use 2026-09-16: "slide preview is unavailable again")  */
/*                                                                            */
/*  The deck caught the failure and dropped it: `onError={() => undefined}`.   */
/*                                                                            */
/*  A retry button was added here, then REMOVED the same day on the founder's  */
/*  call — "it either works or it doesn't". What remains is the honest part:   */
/*  the failure is NAMED rather than swallowed, the box is bounded so it never */
/*  buries the speaker's words, and a new deck or page gets a fresh attempt on */
/*  its own. What is gone is asking the speaker to do the app's job twice.     */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const onErrorSpy = vi.fn();
let failNextLoad = true;

/** Stand in for the real pdf.js page: it calls `onError` while the fixture
 *  says the load fails, and renders a canvas once it says it succeeds. That
 *  is the whole contract this component depends on. */
vi.mock("@/components/willab/pdfSlides", () => ({
  PdfPage: ({ onError }: { onError?: () => void }) => {
    onErrorSpy();
    if (failNextLoad) queueMicrotask(() => onError?.());
    return createElement("canvas", { "data-testid": "page" });
  },
  MockPresentationSlide: ({ title }: { title: string }) =>
    createElement("div", { "data-testid": "mock-slide" }, title),
}));

import DeckSlidePreview from "./DeckSlidePreview";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  failNextLoad = true;
  onErrorSpy.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function render(props: {
  presentationRef: string | null;
  pageIndex: number;
}) {
  await act(async () => {
    root.render(createElement(DeckSlidePreview, props));
  });
}

describe("a deckless project reads the same way as a decked one", () => {

  it("never asks pdf.js for a page when there is no deck", async () => {
    onErrorSpy.mockClear();
    await render({ presentationRef: null, pageIndex: 2 });
    expect(onErrorSpy).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="page"]')).toBeNull();
  });
});

