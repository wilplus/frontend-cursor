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

  it("says so when the load fails, and offers NO retry", async () => {
    // Founder 2026-09-17: "delete the reload button from the ideal text — it
    // either works or it doesn't."
    await render({ presentationRef: "https://cdn.example/deck.pdf", pageIndex: 0 });
    expect(host.textContent).toContain("Slide preview unavailable");
    expect(retryButton()).toBeUndefined();
    expect(host.querySelectorAll("button")).toHaveLength(0);
  });

  it("gives a NEW deck or page a fresh chance without a retry tap", async () => {
    await render({ presentationRef: "https://cdn.example/deck.pdf", pageIndex: 0 });
    expect(host.textContent).toContain("Slide preview unavailable");
    failNextLoad = false;
    await render({ presentationRef: "https://cdn.example/other.pdf", pageIndex: 0 });
    expect(host.textContent).not.toContain("Slide preview unavailable");
  });

  it("BOUNDS the slide so it never buries the words below it", async () => {
    // Founder 2026-09-17: "on the desktop it covers the whole screen and the
    // text is not visible." PdfPage renders at its container's width, so an
    // unbounded box reached 1518x2144 on a desktop column — two and a half
    // viewports of picture above the speaker's own sentences.
    failNextLoad = false;
    await render({ presentationRef: "https://cdn.example/deck.pdf", pageIndex: 0 });
    // The frame is the INNER box: host > spacing div > frame.
    const frame = host.firstElementChild!.firstElementChild as HTMLElement;
    expect(frame.className).toMatch(/aspect-video/);
    expect(frame.className).toMatch(/max-h-\[38vh\]/);
    // ...and the WIDTH is capped to 16:9 of that height, or a real slide
    // letterboxes inside a column-wide letterbox instead of filling the frame.
    expect(frame.className).toMatch(/max-w-\[67vh\]/);
    // The same bound on the failure box, so the layout does not jump.
    failNextLoad = true;
    await render({ presentationRef: "https://cdn.example/other.pdf", pageIndex: 0 });
    expect(
      (host.firstElementChild!.firstElementChild as HTMLElement).className,
    ).toMatch(/aspect-video/);
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

describe("a deckless project reads the same way as a decked one", () => {
  /* FOUNDER 2026-09-19: "when it's ideal text with the mock deck, the mock
     deck also shows up in the slides; when it's ideal text with my deck, it
     also shows up". Presentation Mode and every export adapter already drew
     the canonical mock slides; this surface alone showed nothing, so the same
     document read two different ways depending on whether a PDF had been
     uploaded. DEFAULT_DECK is an F1 piece, not a placeholder — it is what
     makes 1:1 word→slide segmentation defined for a speaker who never
     uploaded anything. */

  it("draws the canonical slide for a page the default deck has", async () => {
    await render({ presentationRef: null, pageIndex: 0 });
    const mock = host.querySelector('[data-testid="mock-slide"]');
    expect(mock).not.toBeNull();
    expect(mock?.textContent).toBe("Main premise");
  });

  it("uses the same bounded frame the uploaded deck gets", async () => {
    // The bound is the whole reason this component exists (founder
    // 2026-09-17: "on the desktop it covers the whole screen and the text is
    // not visible"). A second lane that skipped it would reintroduce that.
    await render({ presentationRef: null, pageIndex: 1 });
    const framed = host.querySelector(".aspect-video.max-h-\\[38vh\\]");
    expect(framed).not.toBeNull();
    expect(framed?.querySelector('[data-testid="mock-slide"]')).not.toBeNull();
  });

  it("never asks pdf.js for a page when there is no deck", async () => {
    onErrorSpy.mockClear();
    await render({ presentationRef: null, pageIndex: 2 });
    expect(onErrorSpy).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="page"]')).toBeNull();
  });

  it("renders nothing for a page the default deck does not have", async () => {
    // A deckless talk has three slides; a fourth was never promised, and an
    // apology box for one is worse than the absence.
    await render({ presentationRef: null, pageIndex: 7 });
    expect(host.querySelector('[data-testid="mock-slide"]')).toBeNull();
    expect(host.textContent).toBe("");
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

  it("and neither surface renders a raw PdfPage any more", () => {
    // Both the deck and the slide editor go through the bounded component, so
    // a size or failure rule can only be written once.
    expect(deck).not.toMatch(/<PdfPage\b/);
  });
});
