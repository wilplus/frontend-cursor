import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * STORY   As a speaker with the iPhone app, I want the dump screen to open
 *         and keep what I say even with no signal, so that a thought on the
 *         metro is not lost.
 * OUTCOME The app hears "on" with the ring row and the notebook's Yes, "off"
 *         without the Yes, and nothing when a read fails (offline).
 * PROVES  A failed read never switches the native screen off (N506 item 3).
 * WHY     One failed request used to switch it off until the next good load.
 */

const { configure, readNotebookState } = vi.hoisted(() => ({
  configure: vi.fn(async (_o: unknown) => undefined),
  readNotebookState: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true },
  registerPlugin: () => ({ configure }),
}));
vi.mock("@/services/api/voiceNotebook", () => ({ readNotebookState: () => readNotebookState() }));
vi.mock("@/lib/willab/dumpScreen", () => ({ openFirst: () => true }));

import { syncApp } from "./dumpScreen";

describe("syncApp", () => {
  beforeEach(() => configure.mockClear());

  it("tells the app on with the ring row and the notebook's Yes", async () => {
    readNotebookState.mockResolvedValue({ enabled: true, consented: true, max_seconds: 300 });
    await syncApp(true);
    expect(configure).toHaveBeenCalledWith({ enabled: true, openFirst: true });
  });

  it("tells the app off when the notebook has no Yes", async () => {
    readNotebookState.mockResolvedValue({ enabled: true, consented: false, max_seconds: 300 });
    await syncApp(true);
    expect(configure).toHaveBeenCalledWith({ enabled: false, openFirst: true });
  });

  it("tells the app nothing when the notebook could not be read (offline)", async () => {
    readNotebookState.mockResolvedValue(null);
    await syncApp(true);
    expect(configure).not.toHaveBeenCalled();
  });
});
