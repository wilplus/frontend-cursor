// @vitest-environment jsdom
/*
STORY    As a speaker, I want the dump screen only in the iPhone app, so that
         the website never opens a screen made for the phone app.
OUTCOME
  H1  In a browser it never opens: not first on an open of the chat, and a
      pull from the top bar opens nothing.
  H2  In the iPhone app, switched on, it is considered on the open and the
      pull opens it.
PROVES   H1, H2 -> "the dump screen is the iPhone app's only"
WHY      Founder 2026-11-06 (backend N540 item 1): "the dump screen should
         work only for the app users; it is not a web feature".
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ on: false }));
const notebook = vi.hoisted(() => ({
  getNotebookState: vi.fn(async () => ({ enabled: false, consented: false, max_seconds: 60 })),
}));

vi.mock("@/lib/auth/nativeSignIn", () => ({ isNativeApp: () => native.on }));
vi.mock("@/hooks/useRingState", () => ({
  useRingState: () => ({
    ring: 2,
    defaultRing: 2,
    hasRingRow: true,
    attributes: {},
    featuresOn: new Set(["dump_screen", "voice_notebook"]),
    pendingAnnouncements: [],
  }),
}));
vi.mock("@/services/api/voiceNotebook", () => notebook);
vi.mock("@/lib/phone/dumpScreen", () => ({
  nativeDump: () => false,
  openNativeDump: async () => false,
  syncApp: async () => null,
  onNativeKept: () => () => undefined,
  onNativeSent: () => () => undefined,
}));

import DumpScreenHost from "./DumpScreenHost";
import { canPullDump, setOpenFirst } from "@/lib/willab/dumpScreen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
beforeEach(() => {
  notebook.getNotebookState.mockClear();
  setOpenFirst(true);
  root = createRoot(document.createElement("div"));
});
afterEach(() => {
  act(() => root.unmount());
});

async function openChat() {
  await act(async () => {
    root.render(createElement(DumpScreenHost, { plain: true }));
  });
}

it("the dump screen is the iPhone app's only", async () => {
  // H1: a browser, with the switch on and the ring row on.
  native.on = false;
  await openChat();
  expect(notebook.getNotebookState).not.toHaveBeenCalled();
  expect(canPullDump()).toBe(false);
  act(() => root.unmount());

  // H2: the iPhone app.
  native.on = true;
  root = createRoot(document.createElement("div"));
  await openChat();
  expect(notebook.getNotebookState).toHaveBeenCalled();
  expect(canPullDump()).toBe(true);
});
