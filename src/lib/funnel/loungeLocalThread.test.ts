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
  window?: { localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> };
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
