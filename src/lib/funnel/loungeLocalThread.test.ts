/*
STORY    As a visitor who then signs up, I want my guest chat, its Ideal Text card included, moved once into my account in the right order, and an old visit on the same device forgotten, so that my conversation is complete and private.
OUTCOME
  O1  The guest chat is sent in time order, then cleared from the device.
  O2  Only a chat claimed by my account moves in, with its Ideal Text card, and only once; an unclaimed chat never moves.
  O3  A chat silent for longer than a sitting is dropped.
PROVES   O1 -> replays chronologically and clears local on success
         O2 -> merges a claimed chat with its Ideal Text card, and never an unclaimed one
         O3 -> drops a thread whose newest message is older than the TTL
WHY      Founder 2026-10-20: a guest who signed up found an empty chat; 2026-10-16: a new visitor saw last night's chat.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock only the network append; keep the rest of the service real.
vi.mock("@/services/api/loungeMessages", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/api/loungeMessages")>();
  return {
    ...actual,
    appendAllLoungeMessages: vi.fn(
      async (m: import("@/services/api/loungeMessages").LoungeMessage[]) => m
    ),
  };
});

import {
  appendLocalLoungeMessage,
  loadLocalLoungeThread,
  markLocalThreadClaimed,
  mergeClaimedLocalThread,
  mergeLocalLoungeThreadToServer,
  readLocalLoungeThread,
} from "./loungeLocalThread";
import {
  appendAllLoungeMessages,
  type LoungeMessage,
} from "@/services/api/loungeMessages";

const msg = (client_id: string, at: string): LoungeMessage => ({
  client_id,
  role: "user",
  kind: "text",
  body: "hi",
  client_created_at: at,
});

type WinShim = {
  window?: {
    localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
    dispatchEvent: (e: Event) => boolean;
  };
};

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as WinShim).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
    dispatchEvent: () => true,
  };
  vi.clearAllMocks();
});

afterEach(() => {
  delete (globalThis as unknown as WinShim).window;
});

describe("mergeLocalLoungeThreadToServer", () => {

  it("replays chronologically and clears local on success", async () => {
    appendLocalLoungeMessage(msg("b", "2026-01-02T00:00:00Z"));
    appendLocalLoungeMessage(msg("a", "2026-01-01T00:00:00Z")); // out of order
    await mergeLocalLoungeThreadToServer();
    const passed = vi.mocked(appendAllLoungeMessages).mock.calls[0]?.[0] ?? [];
    expect(passed.map((m) => m.client_id)).toEqual(["a", "b"]); // sorted ASC
    expect(readLocalLoungeThread()).toEqual([]); // cleared after merge
  });

});

describe("the guest's chat follows the Take into the account", () => {
  // Founder 2026-10-20: a guest who signed up later found an empty chat, "as
  // if my take was not registered". Their chat, the Ideal Text card
  // included, moves in once a claim marks it as the account's; a thread no
  // claim marked (a shared device) never does.
  it("merges a claimed chat with its Ideal Text card, and never an unclaimed one", async () => {
    appendLocalLoungeMessage(msg("rec", "2026-01-01T00:00:00Z"));
    appendLocalLoungeMessage({
      ...msg("ready", "2026-01-01T00:01:00Z"),
      role: "bot",
      kind: "ideal_text",
      metadata: { arc_id: "arc", variant: "ready", version: 1 },
    });
    expect(await mergeClaimedLocalThread()).toBe(false);
    expect(appendAllLoungeMessages).not.toHaveBeenCalled();

    markLocalThreadClaimed();
    expect(await mergeClaimedLocalThread()).toBe(true);
    const passed = vi.mocked(appendAllLoungeMessages).mock.calls[0]?.[0] ?? [];
    expect(passed.map((m) => m.client_id)).toEqual(["rec", "ready"]);
    expect(readLocalLoungeThread()).toEqual([]);
    // Done once: the mark goes with the merge.
    appendLocalLoungeMessage(msg("later", "2026-01-02T00:00:00Z"));
    expect(await mergeClaimedLocalThread()).toBe(false);
  });
});

describe("a visitor's thread expires after a sitting", () => {
  // Founder 2026-10-16: a new visitor on the same device found last
  // night's conversation. An hour of silence ends the sitting.
  it("drops a thread whose newest message is older than the TTL", () => {
    appendLocalLoungeMessage(msg("a", "2026-10-15T22:00:00.000Z"));
    appendLocalLoungeMessage(msg("b", "2026-10-15T22:05:00.000Z"));
    expect(loadLocalLoungeThread(Date.parse("2026-10-15T22:30:00.000Z"))).toHaveLength(2);
    expect(loadLocalLoungeThread(Date.parse("2026-10-16T06:45:00.000Z"))).toEqual([]);
    expect(readLocalLoungeThread()).toEqual([]);
  });
});
