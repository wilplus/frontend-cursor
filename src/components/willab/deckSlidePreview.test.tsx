// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  A FAILED SLIDE PREVIEW IS RECOVERABLE                                      */
/*  (reported from real use 2026-09-16: "slide preview is unavailable again")  */
/*                                                                            */
/*  The deck caught the failure and dropped it: `onError={() => undefined}`.   */
/*  One unlucky fetch left a grey bar until the whole document was reloaded.   */
/*  The recording stage has had the retry since #360; this surface had not.    */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
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

async function render(props: { presentationRef: string; pageIndex: number }) {
  await act(async () => {
    root.render(createElement(DeckSlidePreview, props));
  });
}
const retryButton = () =>
  Array.from(host.querySelectorAll("button")).find(
    (b) => (b.textContent ?? "").trim() === "Retry loading slides",
  );

describe("the deck's slide preview", () => {
  it("shows the page while the load is working", async () => {
    failNextLoad = false;
    await render({ presentationRef: "https://cdn.example/deck.pdf", pageIndex: 0 });
    expect(host.querySelector('[data-testid="page"]')).toBeTruthy();
    expect(host.textContent).not.toContain("Slide preview unavailable");
  });

  it("says so when the load fails, and OFFERS A WAY BACK", async () => {
    await render({ presentationRef: "https://cdn.example/deck.pdf", pageIndex: 0 });
    expect(host.textContent).toContain("Slide preview unavailable");
    expect(retryButton()).toBeTruthy();
  });

  it("really re-fetches on retry, and recovers when the fetch works", async () => {
    // `loadPdf` evicts a failed promise from its cache, so remounting the page
    // is a real second attempt rather than a re-read of the failure.
    await render({ presentationRef: "https://cdn.example/deck.pdf", pageIndex: 0 });
    const attemptsBeforeRetry = onErrorSpy.mock.calls.length;
    failNextLoad = false;
    await act(async () => {
      retryButton()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onErrorSpy.mock.calls.length).toBeGreaterThan(attemptsBeforeRetry);
    expect(host.querySelector('[data-testid="page"]')).toBeTruthy();
    expect(host.textContent).not.toContain("Slide preview unavailable");
  });

  it("gives a NEW deck or page a fresh chance without a retry tap", async () => {
    await render({ presentationRef: "https://cdn.example/deck.pdf", pageIndex: 0 });
    expect(host.textContent).toContain("Slide preview unavailable");
    failNextLoad = false;
    await render({ presentationRef: "https://cdn.example/other.pdf", pageIndex: 0 });
    expect(host.textContent).not.toContain("Slide preview unavailable");
  });

  it("keeps the retry tappable on a phone", async () => {
    await render({ presentationRef: "https://cdn.example/deck.pdf", pageIndex: 0 });
    expect(retryButton()!.className).toMatch(/min-h-\[44px\]/);
  });

  it("never substitutes the words for the picture", () => {
    // SlideRender's rule, held here too: what the speaker said while a slide
    // was on screen is not a picture of that slide.
    const src = readFileSync(
      "src/components/willab/DeckSlidePreview.tsx",
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/transcript|chunk\.|part\.text/i);
  });
});

describe("the deck uses it instead of a raw page with a swallowed error", () => {
  const deck = readFileSync(
    "src/components/willab/TranscriptReviewDeck.tsx",
    "utf8",
  );

  it("renders the recoverable preview on the deck", () => {
    expect(deck).toMatch(/<DeckSlidePreview\b/);
  });

  it("no longer drops the failure on the floor", () => {
    expect(deck).not.toMatch(/onError=\{\(\) => undefined\}[\s\S]{0,80}className="w-full"/);
  });
});
