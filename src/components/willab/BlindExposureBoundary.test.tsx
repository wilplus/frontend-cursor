// @vitest-environment jsdom
/*
STORY    As the founder, I want a coach card counted as seen only once it is
         actually visible, and exactly once, so that blind-review records are
         honest.
OUTCOME
  O1  Never-2 record: a card that is mounted but off-screen sends no receipt,
      while its content is still rendered.
  O2  Once visible, exactly one receipt is sent, even when visibility fires
      again and the card re-renders; its exposure id reaches the card.
PROVES   O1 -> "creates nothing for a mounted card that never becomes visible"
         O2 -> "records exactly one exposure when visible, however often visibility fires"
WHY      Blind coach review: an exposure is the proof of what the coach saw, and when.
*/

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlindExposureBoundary } from "./BlindExposureBoundary";

const chainHandle = {
  reviewAssignmentId: "20000000-0000-4000-8000-000000000003",
  presentationId: "20000000-0000-4000-8000-000000000005",
  acknowledgementToken: "20000000-0000-4000-8000-000000000006",
  visiblePayloadSha256: "b".repeat(64),
};

let observerCallback: IntersectionObserverCallback | null = null;
let root: Root;
let container: HTMLDivElement;

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0.01];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
}

function acknowledged(exposureId: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    receipt: {
      reviewAssignmentId: chainHandle.reviewAssignmentId,
      presentationId: chainHandle.presentationId,
      exposureId,
    },
  });
}

async function intersect(isIntersecting: boolean): Promise<void> {
  await act(async () => {
    observerCallback?.([
      { isIntersecting } as IntersectionObserverEntry,
    ], {} as IntersectionObserver);
  });
}

beforeEach(() => {
  observerCallback = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BlindExposureBoundary", () => {
  it("creates nothing for a mounted card that never becomes visible", async () => {
    const acknowledge = acknowledged("exposure-1");
    await act(async () => {
      // eslint-disable-next-line react/no-children-prop
      root.render(createElement(
        BlindExposureBoundary<typeof chainHandle>,
        {
          blindReview: chainHandle,
          acknowledge,
          scope: "coach-card",
          children: () => createElement("span", null, "card"),
        },
      ));
    });

    await intersect(false);

    expect(observerCallback).not.toBeNull();
    expect(container.textContent).toBe("card");
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("records exactly one exposure when visible, however often visibility fires", async () => {
    const acknowledge = acknowledged("exposure-1");
    const props = {
      blindReview: chainHandle,
      acknowledge,
      scope: "coach-card",
      children: ({ exposureId }: { exposureId: string | null }) =>
        createElement("span", null, exposureId ?? "waiting"),
    };
    const render = () =>
      act(async () => {
        root.render(createElement(BlindExposureBoundary<typeof chainHandle>, props));
      });

    await render();
    await intersect(true);
    await intersect(true);
    await render();
    await intersect(true);

    expect(acknowledge).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("exposure-1");
  });
});
