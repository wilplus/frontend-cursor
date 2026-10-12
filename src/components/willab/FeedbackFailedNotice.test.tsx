// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE PAGE SAYS SO WHEN THE FEEDBACK COULD NOT BE MADE (Phase 2)             */
/*                                                                            */
/*  The server serves no stand-in items when V3 fails (contract 24h). The page */
/*  retries once by itself, then shows the signed-off sentence with Try again. */
/* -------------------------------------------------------------------------- */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeedbackFailedNotice, {
  FEEDBACK_RETRY_DELAY_MS,
} from "./FeedbackFailedNotice";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function render(failed: boolean, onRetry: () => void) {
  act(() => {
    root.render(createElement(FeedbackFailedNotice, { failed, onRetry }));
  });
}

describe("FeedbackFailedNotice", () => {

  it("says so, with Try again, when the retry failed too", () => {
    const onRetry = vi.fn();
    render(true, onRetry);
    act(() => vi.advanceTimersByTime(FEEDBACK_RETRY_DELAY_MS));
    render(true, onRetry);
    expect(host.textContent).toContain(IDEAL_EDIT_COPY.feedbackFailed);
    const button = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === IDEAL_EDIT_COPY.feedbackRetry,
    );
    act(() => button?.click());
    expect(onRetry).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(FEEDBACK_RETRY_DELAY_MS * 3));
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
