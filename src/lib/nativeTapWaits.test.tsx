// @vitest-environment jsdom
/*
STORY    As a speaker with the iPhone app, I want a notification or a link I
         tap while my Take is recorded, or before the server has it, to wait
         and then open, so that a tap never throws my Take away.
OUTCOME
  O1  Tapped while a Take is recorded or going up, the page a notification
      or a link names does not open.
  O2  It opens once the server has the Take, or once the Take is discarded
      or the screens close; a later tap replaces an earlier one, so only the
      latest page opens.
  O3  With no Take at risk, it opens at once.
PROVES   O1, O2 -> "a tap while a Take is at risk waits, then opens once the server has the Take"
         O2 -> "a waiting tap opens once the Take is discarded, or the screens close"
         O3 -> "a tap with no Take at risk opens at once"
WHY      Founder 2026-11-09, backend N560 item 3 ("Wait, then go"): a tapped
         push or link reloaded the page at once and the Take was lost.
         Never 3.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { takeNotYetAccepted, useLeaveGuard } from "@/components/willab/labLeaveGuard";

const native = vi.hoisted(() => {
  const on: Record<string, (event: unknown) => void> = {};
  const addListener = async (name: string, fn: (event: unknown) => void) => {
    on[name] = fn;
    return { remove: async () => undefined };
  };
  return { on, addListener };
});
vi.mock("@capacitor/app", () => ({ App: { addListener: native.addListener } }));
vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    addListener: native.addListener,
    checkPermissions: async () => ({ receive: "denied" }),
  },
}));
vi.mock("@/lib/auth/nativeSignIn", () => ({ isNativeApp: () => true }));

import { startNativeLinks } from "./nativeLinks";
import { startNativePush } from "./nativePush";

type TakeWindow = Parameters<typeof takeNotYetAccepted>[0];

let root: Root;
let host: HTMLDivElement;
const assign = vi.fn();

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("location", { pathname: "/chat", search: "", hash: "", assign });
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
  await startNativeLinks();
  await startNativePush();
});

afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  await settle();
  assign.mockReset();
  vi.unstubAllGlobals();
});

/** The overlay's one line: the guard on the condition LabOverlay passes it. */
function Guarded(props: TakeWindow) {
  useLeaveGuard(takeNotYetAccepted(props));
  return null;
}

function show(props: TakeWindow) {
  act(() => root.render(createElement(Guarded, props)));
}

/** Let the screens finish what they were doing. */
async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

/** A WillpowerLab link tapped in Messages opens the app. */
const tapLink = (url: string) => native.on.appUrlOpen({ url });
/** A push notification tapped on the lock screen. */
const tapPush = (path: string) =>
  native.on.pushNotificationActionPerformed({ notification: { data: { path } } });

const take = new Blob(["voice"], { type: "audio/webm" });

describe("a tap while a Take is at risk waits, then goes (N560 item 3)", () => {
  it("a tap while a Take is at risk waits, then opens once the server has the Take", async () => {
    show({ state: "lab_recording", micStatus: "recording", blob: null, heldBlob: null });
    tapLink("https://www.willpowerlab.com/chat?lens=arc-1");
    await settle();
    expect(assign).not.toHaveBeenCalled();

    // Finished and going up: still only in this tab. A second tap replaces the first.
    show({ state: "lab_processing", micStatus: "stopped", blob: take, heldBlob: null });
    tapPush("/chat?lens=arc-2");
    await settle();
    expect(assign).not.toHaveBeenCalled();

    // The server answers that it has the Take.
    show({ state: "lab_processing", micStatus: "stopped", blob: take, heldBlob: take });
    await settle();
    expect(assign.mock.calls).toEqual([["/chat?lens=arc-2"]]);
  });

  it("a waiting tap opens once the Take is discarded, or the screens close", async () => {
    show({ state: "lab_processing", micStatus: "stopped", blob: take, heldBlob: null });
    tapPush("/chat?lens=arc-3");
    await settle();
    expect(assign).not.toHaveBeenCalled();
    // "Discard this take?": the Take is dropped and the mic goes back to idle.
    show({ state: "lab_recording", micStatus: "idle", blob: null, heldBlob: null });
    await settle();
    expect(assign.mock.calls).toEqual([["/chat?lens=arc-3"]]);

    assign.mockReset();
    show({ state: "lab_recording", micStatus: "recording", blob: null, heldBlob: null });
    tapLink("https://willpowerlab.com/c/q3V8kR2mZ");
    await settle();
    expect(assign).not.toHaveBeenCalled();
    act(() => root.unmount());
    await settle();
    expect(assign.mock.calls).toEqual([["/c/q3V8kR2mZ"]]);
    act(() => {
      root = createRoot(host);
    });
  });

  it("a tap with no Take at risk opens at once", () => {
    show({ state: "lab_prerecord", micStatus: "idle", blob: null, heldBlob: null });
    tapLink("https://www.willpowerlab.com/chat?lens=arc-4");
    expect(assign.mock.calls).toEqual([["/chat?lens=arc-4"]]);
    tapPush("/account/settings");
    expect(assign.mock.calls).toEqual([["/chat?lens=arc-4"], ["/account/settings"]]);
  });
});
