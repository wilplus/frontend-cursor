// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  A RE-RENDER MUST NOT TURN THE SLIDE OFF                                    */
/*  (founder 2026-09-19: "the truncation of the text works but the slides are  */
/*   gone... it seems like it flips when one works the other doesn't")         */
/*                                                                            */
/*  It was one latent race, exposed rather than caused by the screen split.    */
/*                                                                            */
/*  `onError` sat in the render effect's dependency list, and every caller     */
/*  writes it inline — `onError={() => setFailed(true)}` — so it was a new     */
/*  function on every parent render and the effect re-ran whenever anything    */
/*  above it re-rendered. The cleanup set a local flag; it never cancelled the */
/*  render, which stayed live inside pdf.js with the canvas still in its       */
/*  `#canvasInUse` set. The canvas element is stable across re-renders, so the */
/*  next run handed pdf.js a canvas it considered busy, and pdf.js threw by    */
/*  design (pdf.mjs: "Cannot use the same canvas during multiple render()      */
/*  operations"). That throw arrived with `cancelled` false, was reported as a */
/*  real failure, and `DeckSlidePreview` only clears its failed state when the */
/*  url or page changes — so one spurious re-render turned the slide off for   */
/*  good.                                                                      */
/*                                                                            */
/*  Putting more previews on screen (one per SCREEN rather than one per slide) */
/*  is what took this from occasional to certain.                              */
/*                                                                            */
/*  The fake below enforces the same canvas rule pdf.js does, so these tests   */
/*  fail against the old code with the production error rather than a proxy    */
/*  for it.                                                                    */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeTask {
  promise: Promise<void>;
  cancel: () => void;
  finish: () => void;
  cancelled: boolean;
}

/** pdf.js's own rule: one live render per canvas, tracked by identity. */
const canvasInUse = new WeakSet<object>();
let tasks: FakeTask[] = [];
let renderCalls = 0;

function startRender(canvas: object): FakeTask {
  if (canvasInUse.has(canvas)) {
    throw new Error(
      "Cannot use the same canvas during multiple render() operations.",
    );
  }
  canvasInUse.add(canvas);
  let settle: () => void = () => {};
  let fail: (e: Error) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    settle = res;
    fail = (e) => rej(e);
  });
  const task: FakeTask = {
    promise,
    cancelled: false,
    cancel: () => {
      canvasInUse.delete(canvas);
      task.cancelled = true;
      // pdf.js names the exception rather than subclassing something the
      // caller could recognise structurally (pdf.mjs: BaseException sets
      // `name`), so the name is the whole contract.
      const cancellation = new Error("Rendering cancelled.");
      cancellation.name = "RenderingCancelledException";
      fail(cancellation);
    },
    finish: () => {
      canvasInUse.delete(canvas);
      settle();
    },
  };
  return task;
}

vi.mock("pdfjs-dist", () => ({
  version: "test",
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 4,
      getPage: async () => ({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 800 * scale,
          height: 450 * scale,
        }),
        render: ({
          canvasContext,
        }: {
          canvasContext: { canvas: object };
        }) => {
          renderCalls += 1;
          const task = startRender(canvasContext.canvas);
          tasks.push(task);
          return task;
        },
      }),
    }),
  }),
}));

import { PdfPage } from "./pdfSlides";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  tasks = [];
  renderCalls = 0;
  // jsdom has no 2d context. The component only needs something to hand to
  // pdf.js, and the canvas identity is what the rule above turns on.
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    return { canvas: this };
  } as unknown as HTMLCanvasElement["getContext"];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

/** One distinct url per test: `docCache` in the module is keyed by url and
 *  deliberately outlives a component, which is the point of it. */
let urlSeq = 0;
const freshUrl = () => `https://deck.test/${(urlSeq += 1)}.pdf`;

async function mount(props: {
  url: string;
  pageIndex: number;
  onError: () => void;
}) {
  await act(async () => {
    root.render(createElement(PdfPage, props));
  });
}

describe("a parent re-render does not restart the page render", () => {
  it("ignores a new onError identity while the page is still drawing", async () => {
    // THE BUG, exactly: the caller writes `onError={() => setFailed(true)}`,
    // so this second render passes a different function for the same
    // intention. That used to re-run the effect against a busy canvas.
    const onError = vi.fn();
    const url = freshUrl();
    await mount({ url, pageIndex: 1, onError: () => onError() });
    expect(renderCalls).toBe(1);

    await mount({ url, pageIndex: 1, onError: () => onError() });

    expect(renderCalls).toBe(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports nothing after the first render completes either", async () => {
    const onError = vi.fn();
    const url = freshUrl();
    await mount({ url, pageIndex: 1, onError: () => onError() });
    await act(async () => tasks[0].finish());

    await mount({ url, pageIndex: 1, onError: () => onError() });

    expect(renderCalls).toBe(1);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("a real change still redraws, and releases the canvas first", () => {
  it("cancels the live render before starting the new page", async () => {
    const onError = vi.fn();
    const url = freshUrl();
    await mount({ url, pageIndex: 1, onError });
    expect(tasks).toHaveLength(1);

    await mount({ url, pageIndex: 2, onError });

    // Cancelled, not merely ignored — that is what frees the canvas, and
    // without it the second render throws pdf.js's busy-canvas error.
    expect(tasks[0].cancelled).toBe(true);
    expect(renderCalls).toBe(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not report a cancellation as a failed slide", async () => {
    // pdf.js rejects a cancelled render. Treating that as a failure is how
    // the preview latched off: the box only clears when the url or page
    // changes, and neither had.
    const onError = vi.fn();
    const url = freshUrl();
    await mount({ url, pageIndex: 1, onError });
    await act(async () => {
      tasks[0].cancel();
    });
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("a genuine failure is still reported", () => {
  it("names a page the deck does not have", async () => {
    // The fence this must not break: fail-closed stays fail-closed.
    const onError = vi.fn();
    await mount({ url: freshUrl(), pageIndex: 99, onError });
    expect(onError).toHaveBeenCalled();
    expect(renderCalls).toBe(0);
  });
});
