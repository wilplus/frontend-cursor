// @vitest-environment jsdom
/*
 * STORY    As a speaker who just recorded a Take, I want the walk to open
 *          the moment its processing is done, with nothing in between, so
 *          that the loop goes straight from my Take to my feedback.
 * OUTCOME
 *   O1  When the Take's processing is done the wait stays over the walk
 *       as it opens, from the Take's own marker, also when the Lounge was
 *       not following that job (I came back to the app, or left the wait
 *       for the chat): the chat is never shown in between (backend N319
 *       item 10). A guest's text, which opens behind its own ask, and a
 *       failed Take get no cover.
 * PROVES   O1 -> "the walk opens under the wait from the Take's own marker"
 * WHY      Founder 2026-11-01 (N319 item 10): "after the Take's processing
 *          the walk opens at once; the chat is never shown in between".
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useWaitScreen } from "./useWaitScreen";
import type { ProcessingTake } from "@/lib/willab/processingTake";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const TAKE: ProcessingTake = {
  sessionId: "take-2",
  arcId: "arc-1",
  takeIndex: 2,
  startedAt: 1_000,
  phase: "document",
  status: "processing",
  phaseStartedAt: 2_000,
  progress: { stage: "document_assembly", percent: null },
};

type Screen = ReturnType<typeof useWaitScreen>;

function mount(signedIn: boolean): () => Screen {
  let screen: Screen | null = null;
  function Lounge() {
    screen = useWaitScreen({
      userId: "u1",
      signedIn,
      labOpen: false,
      handedOver: null,
      onHandedOverShown: undefined,
      resume: null, // the Lounge was not following this job
      openedSessionId: null,
      show: () => undefined,
    });
    return null;
  }
  act(() => root.render(createElement(Lounge)));
  return () => screen!;
}

it("the walk opens under the wait from the Take's own marker", () => {
  const screen = mount(true);
  expect(screen().view).toBeNull(); // the chat, while nothing is done
  act(() => screen().coverWalk(TAKE));
  expect(screen().view).toMatchObject({ sessionId: "take-2", status: "analyzing", phase: "document" });

  const guest = mount(false);
  act(() => guest().coverWalk(TAKE));
  expect(guest().view).toBeNull();

  const failed = mount(true);
  act(() => failed().coverWalk({ ...TAKE, status: "failed" }));
  expect(failed().view).toBeNull();
});
