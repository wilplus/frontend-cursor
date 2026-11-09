// @vitest-environment jsdom
/*
STORY    As a speaker opening the iPhone app, I want my chat drawn before the
         phone signs up for pushes, and a notification I tapped to open its
         page at once, so that the chat appears fast and pushes still reach me.
OUTCOME
  O1  Opening the chat, the phone's push address goes to the server only
      once the thread has painted, even while the members check is still
      out; the tap that opened the app is listened for at once.
  O2  On a page with no chat to open, the phone signs up for pushes at once,
      as before.
PROVES   O1 -> "opening the chat, the phone signs up for pushes after the thread has painted"
         O2 -> "on any other page, the phone signs up for pushes at once"
WHY      Loading time (2026-11-09): the push-device POST went out in the
         app's opening burst, beside the chat's boot reads (founder
         2026-10-16, chatBoot.ts).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => ({
  listeners: new Map<string, (event: unknown) => void>(),
  register: vi.fn(),
}));
vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    addListener: async (name: string, cb: (event: unknown) => void) => {
      push.listeners.set(name, cb);
      return { remove: async () => void push.listeners.delete(name) };
    },
    checkPermissions: async () => ({ receive: "granted" }),
    requestPermissions: async () => ({ receive: "granted" }),
    register: push.register,
  },
}));
vi.mock("@/lib/auth/nativeSignIn", async (original) => ({
  ...(await original<typeof import("@/lib/auth/nativeSignIn")>()),
  isNativeApp: () => true, // in the iPhone app
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "token", user: { id: "maria" } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }),
}));

import NativePush from "./NativePush";
import { __resetChatBootForTests, markChatBootSettled } from "@/lib/chatBoot";
import { __resetAccessForTests } from "@/services/api/access";
import { __resetBootPrefetchForTests, prefetchChatOpen } from "@/services/api/bootPrefetch";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DEVICE = "POST /api/v2/user/push-device";
const fetchMock = vi.fn();
const requests = () =>
  fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${String(url).split("?")[0]}`);
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  __resetChatBootForTests();
  __resetAccessForTests();
  __resetBootPrefetchForTests();
  push.listeners.clear();
  push.register.mockReset();
  // Apple hands the phone its address; the app's listener sends it on.
  push.register.mockImplementation(async () => push.listeners.get("registration")?.({ value: "apns-maria" }));
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) =>
    String(url).startsWith("/api/v2/me/access")
      ? new Promise<Response>(() => {}) // the members check is still out
      : Promise.resolve(json({})),
  );
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("push in the app, as it opens", () => {
  it("opening the chat, the phone signs up for pushes after the thread has painted", async () => {
    void prefetchChatOpen({ parked: false }); // /chat opens: its boot reads go out
    await act(async () => root.render(createElement(NativePush)));

    // The tap that opened the app is heard while the chat still loads.
    await vi.waitFor(() => expect(push.listeners.has("pushNotificationActionPerformed")).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50)); // well past "idle"
    expect(push.register).not.toHaveBeenCalled();
    expect(requests()).not.toContain(DEVICE);

    markChatBootSettled(); // the thread has painted
    await vi.waitFor(() => expect(requests()).toContain(DEVICE));
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url) === "/api/v2/user/push-device")!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ token: "apns-maria" });
  });

  it("on any other page, the phone signs up for pushes at once", async () => {
    await act(async () => root.render(createElement(NativePush)));
    await vi.waitFor(() => expect(requests()).toContain(DEVICE));
  });
});
