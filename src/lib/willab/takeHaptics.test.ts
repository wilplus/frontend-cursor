/*
STORY    As a speaker recording in the iPhone app, I want to feel the Take
         start, the slide move, the Take finish and a Take thrown away, so
         that I know without looking (backend N678 item 1).
OUTCOME
  O1  In the app each recording moment gives its own tick.
  O2  In a browser nothing is asked of the phone.
PROVES   O1 -> "ticks each recording moment in the app"
         O2 -> "stays silent in a browser"
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ app: true }));
const haptics = vi.hoisted(() => ({ impact: vi.fn(async () => undefined), notification: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth/nativeSignIn", () => ({ isNativeApp: () => env.app }));
vi.mock("@capacitor/haptics", () => ({
  Haptics: haptics,
  ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM" },
  NotificationType: { Success: "SUCCESS", Warning: "WARNING" },
}));

import { takeHaptic } from "./takeHaptics";

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the recording moments you feel", () => {
  beforeEach(() => {
    haptics.impact.mockClear();
    haptics.notification.mockClear();
  });

  it("ticks each recording moment in the app", async () => {
    env.app = true;
    takeHaptic("start");
    takeHaptic("slide");
    takeHaptic("finish");
    takeHaptic("discard");
    await vi.waitFor(() => expect(haptics.notification).toHaveBeenCalledTimes(2));
    expect(haptics.impact.mock.calls).toEqual([[{ style: "MEDIUM" }], [{ style: "LIGHT" }]]);
    expect(haptics.notification.mock.calls).toEqual([[{ type: "SUCCESS" }], [{ type: "WARNING" }]]);
  });

  it("stays silent in a browser", async () => {
    env.app = false;
    takeHaptic("start");
    takeHaptic("finish");
    await settle();
    await settle();
    expect(haptics.impact).not.toHaveBeenCalled();
    expect(haptics.notification).not.toHaveBeenCalled();
  });
});
