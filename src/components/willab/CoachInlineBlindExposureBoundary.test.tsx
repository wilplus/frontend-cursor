// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoachInlineBlindExposureBoundary from "./CoachInlineBlindExposureBoundary";
import { acknowledgeCoachInlineBlindRender } from "@/services/api/stateRatings";

vi.mock("@/services/api/stateRatings", async (load) => {
  const actual = await load<typeof import("@/services/api/stateRatings")>();
  return { ...actual, acknowledgeCoachInlineBlindRender: vi.fn() };
});

const blindReview = {
  projectId: "10000000-0000-4000-8000-000000000001",
  reviewBatchId: "10000000-0000-4000-8000-000000000002",
  reviewAssignmentId: "10000000-0000-4000-8000-000000000003",
  blindPacketId: "10000000-0000-4000-8000-000000000004",
  presentationId: "10000000-0000-4000-8000-000000000005",
  acknowledgementToken: "10000000-0000-4000-8000-000000000006",
  visiblePayloadSha256: "a".repeat(64),
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
  vi.mocked(acknowledgeCoachInlineBlindRender).mockResolvedValue({
    ok: true,
    receipt: {
      reviewAssignmentId: blindReview.reviewAssignmentId,
      presentationId: blindReview.presentationId,
      exposureId: "exposure-1",
    },
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CoachInlineBlindExposureBoundary", () => {
  it("creates nothing for a mounted card that never becomes visible", async () => {
    await act(async () => {
      // eslint-disable-next-line react/no-children-prop
      root.render(createElement(
        CoachInlineBlindExposureBoundary,
        {
          blindReview,
          children: () => createElement("span", null, "card"),
        },
      ));
    });

    expect(observerCallback).not.toBeNull();
    expect(acknowledgeCoachInlineBlindRender).not.toHaveBeenCalled();
  });

  it("records exactly one exposure when visible without requiring a click", async () => {
    await act(async () => {
      // eslint-disable-next-line react/no-children-prop
      root.render(createElement(
        CoachInlineBlindExposureBoundary,
        {
          blindReview,
          children: ({ exposureId }: { exposureId: string | null }) =>
            createElement("span", null, exposureId ?? "waiting"),
        },
      ));
    });
    await act(async () => {
      observerCallback?.([
        { isIntersecting: true } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    expect(acknowledgeCoachInlineBlindRender).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("exposure-1");
  });
});
