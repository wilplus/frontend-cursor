// @vitest-environment jsdom
/* The Lounge's queue bubble (founder 2026-10-18): it never says "Nobody is
   waiting for you." before the queue has been read, and a coach re-entering
   the Lounge on the same device sees the last count right away. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMomentsQueue = vi.fn();
vi.mock("@/services/api/coachWalk", async (orig) => ({
  ...(await orig<typeof import("@/services/api/coachWalk")>()),
  fetchMomentsQueue: (...a: unknown[]) => fetchMomentsQueue(...a),
}));

import { CoachWalkBubble } from "./CoachWalkBubble";
import { useMomentsQueue } from "./useMomentsQueue";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Door() {
  const queue = useMomentsQueue(true);
  return <CoachWalkBubble waiting={queue.waiting} onOpen={() => {}} />;
}

const ONE_WAITING = {
  ok: true,
  speakers: [{ pseudonym: "Ash", goal: null, waiting: 2, takes: [] }],
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  fetchMomentsQueue.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the queue bubble", () => {
  it("shows no label until the queue is read, then the count", async () => {
    let resolve: (v: unknown) => void = () => {};
    fetchMomentsQueue.mockReturnValue(new Promise((r) => (resolve = r)));
    await act(async () => root.render(<Door />));
    expect(host.textContent).not.toContain(COPY.queueEmpty);
    expect(host.querySelector('[data-testid="coach-walk-bubble-unread"]')).not.toBeNull();
    await act(async () => resolve(ONE_WAITING));
    expect(host.textContent).toContain(COPY.bubbleWaiting(1));
    expect(host.textContent).toContain(COPY.newTag);
  });

  it("re-entering the Lounge shows the remembered count right away", async () => {
    fetchMomentsQueue.mockResolvedValue(ONE_WAITING);
    await act(async () => root.render(<Door />));
    expect(host.textContent).toContain(COPY.bubbleWaiting(1));
    act(() => root.unmount());

    fetchMomentsQueue.mockReturnValue(new Promise(() => {}));
    root = createRoot(host);
    await act(async () => root.render(<Door />));
    expect(host.textContent).toContain(COPY.bubbleWaiting(1));
  });

  it("says nobody is waiting only once the queue was read empty", async () => {
    fetchMomentsQueue.mockResolvedValue({ ok: true, speakers: [] });
    await act(async () => root.render(<Door />));
    expect(host.textContent).toContain(COPY.queueEmpty);
    expect(host.textContent).not.toContain(COPY.newTag);
  });
});
