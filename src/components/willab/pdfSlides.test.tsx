// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want my slide picture to stay on screen through
 *          re-renders, so that the slide does not vanish while I record.
 * OUTCOME
 *   O1  Re-rendering the parent with a new inline onError keeps one live
 *       render, draws the slide and reports no error.
 *   O2  A real page change cancels the old render and draws again, with no
 *       error.
 *   O3  A cancelled render is not reported as a failed slide.
 * PROVES   O1 -> "a parent re-render with a new onError keeps the slide drawn"
 *          O2 -> "a page change cancels the old render and redraws"
 *          O3 -> "does not report a cancellation as a failed slide"
 * WHY      Founder 2026-09-19 "the slides are gone": an inline onError
 *          restarted the render on a busy canvas and latched the slide off.
 *          The fake below enforces pdf.js's one-render-per-canvas rule.
 */
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

const canvas = () => host.querySelector("canvas")!;

describe("a re-render must not turn the slide off", () => {
  it("a parent re-render with a new onError keeps the slide drawn", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const url = freshUrl();
    await mount({ url, pageIndex: 0, onError: () => first() });
    // The parent re-renders and, as every caller does, writes onError inline.
    await mount({ url, pageIndex: 0, onError: () => second() });
    await act(async () => {
      tasks[tasks.length - 1].finish();
    });
    expect(renderCalls).toBe(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(canvas().className).not.toContain("hidden");
  });

  it("a page change cancels the old render and redraws", async () => {
    const onError = vi.fn();
    const url = freshUrl();
    await mount({ url, pageIndex: 0, onError });
    await mount({ url, pageIndex: 1, onError });
    expect(renderCalls).toBe(2);
    expect(tasks[0].cancelled).toBe(true);
    await act(async () => {
      tasks[1].finish();
    });
    expect(onError).not.toHaveBeenCalled();
    expect(canvas().className).not.toContain("hidden");
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
