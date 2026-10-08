// @vitest-environment jsdom

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

async function becomeVisible(): Promise<void> {
  await act(async () => {
    observerCallback?.([
      { isIntersecting: true } as IntersectionObserverEntry,
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

    expect(observerCallback).not.toBeNull();
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("records exactly one exposure when visible without requiring a click", async () => {
    const acknowledge = acknowledged("exposure-1");
    await act(async () => {
      // eslint-disable-next-line react/no-children-prop
      root.render(createElement(
        BlindExposureBoundary<typeof chainHandle>,
        {
          blindReview: chainHandle,
          acknowledge,
          scope: "coach-card",
          children: ({ exposureId }: { exposureId: string | null }) =>
            createElement("span", null, exposureId ?? "waiting"),
        },
      ));
    });
    await becomeVisible();

    expect(acknowledge).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("exposure-1");
  });

  it("confirms through the given transport under its own scope", async () => {
    const acknowledge = acknowledged("exposure-9");
    await act(async () => {
      // eslint-disable-next-line react/no-children-prop
      root.render(createElement(
        BlindExposureBoundary<typeof chainHandle>,
        {
          blindReview: chainHandle,
          acknowledge,
          scope: "coach-card",
          children: ({ exposureId }: { exposureId: string | null }) =>
            createElement("span", null, exposureId ?? "waiting"),
        },
      ));
    });
    await becomeVisible();

    expect(acknowledge).toHaveBeenCalledTimes(1);
    expect(acknowledge.mock.calls[0][0]).toBe(chainHandle);
    expect(acknowledge.mock.calls[0][1].idempotencyKey).toMatch(
      new RegExp(`^coach-card-visible-render:${chainHandle.presentationId}:`),
    );
    expect(window.sessionStorage.getItem(
      `willab:coach-card-render:${chainHandle.presentationId}`,
    )).not.toBeNull();
    expect(container.textContent).toContain("exposure-9");
  });

  it("a receipt for another card is refused and no exposure is reported", async () => {
    const acknowledge = vi.fn().mockResolvedValue({
      ok: true,
      receipt: {
        reviewAssignmentId: "30000000-0000-4000-8000-000000000003",
        presentationId: chainHandle.presentationId,
        exposureId: "exposure-x",
      },
    });
    await act(async () => {
      // eslint-disable-next-line react/no-children-prop
      root.render(createElement(
        BlindExposureBoundary<typeof chainHandle>,
        {
          blindReview: chainHandle,
          acknowledge,
          scope: "coach-card",
          children: ({ exposureId, error }: { exposureId: string | null; error: string | null }) =>
            createElement("span", null, exposureId ?? error ?? "waiting"),
        },
      ));
    });
    await becomeVisible();
    expect(container.textContent).not.toContain("exposure-x");
    expect(container.textContent).toContain("did not match");
  });
});
