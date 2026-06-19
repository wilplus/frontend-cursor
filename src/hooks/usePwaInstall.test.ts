import { describe, expect, it } from "vitest";
import {
  detectInAppBrowser,
  detectIpadOS,
  resolveInstallPath,
  type InstallPath,
} from "./usePwaInstall";

/* Real-world-ish UA fragments for the platforms the matrix cares about. */
const IPAD_OS = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15";
const IG =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0";

describe("detectIpadOS", () => {
  it("flags iPadOS 13+ (Macintosh UA with touch points)", () => {
    expect(detectIpadOS(IPAD_OS, 5)).toBe(true);
  });
  it("does not flag a real Mac (no touch screen)", () => {
    expect(detectIpadOS(MAC, 0)).toBe(false);
  });
  it("does not flag a non-Macintosh UA", () => {
    expect(detectIpadOS("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", 5)).toBe(false);
  });
});

describe("detectInAppBrowser", () => {
  it("flags Instagram / Facebook / LinkedIn webviews", () => {
    expect(detectInAppBrowser(IG)).toBe(true);
    expect(detectInAppBrowser("... FBAN/FBIOS ...")).toBe(true);
    expect(detectInAppBrowser("... LinkedInApp ...")).toBe(true);
  });
  it("does not flag plain mobile Safari", () => {
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1"
      )
    ).toBe(false);
  });
});

describe("resolveInstallPath", () => {
  const base = {
    ready: true,
    isStandalone: false,
    canPromptNative: false,
    iosFamily: false,
    isIpad: false,
    isRealSafari: false,
  };
  const path = (over: Partial<typeof base>): InstallPath =>
    resolveInstallPath({ ...base, ...over });

  it("renders nothing until detection has run", () => {
    expect(path({ ready: false, canPromptNative: true })).toBe("none");
  });
  it("renders nothing when already installed (standalone), any platform", () => {
    expect(path({ isStandalone: true, canPromptNative: true })).toBe("none");
    expect(
      path({ isStandalone: true, iosFamily: true, isRealSafari: true })
    ).toBe("none");
  });
  it("Android/Chromium with a captured event → native", () => {
    expect(path({ canPromptNative: true })).toBe("native");
  });
  it("iPhone real Safari → ios-safari", () => {
    expect(path({ iosFamily: true, isRealSafari: true })).toBe("ios-safari");
  });
  it("iPad real Safari → ipad-safari", () => {
    expect(path({ iosFamily: true, isRealSafari: true, isIpad: true })).toBe(
      "ipad-safari"
    );
  });
  it("iOS family but not real Safari (in-app / CriOS) → open-in-safari", () => {
    expect(path({ iosFamily: true, isRealSafari: false })).toBe(
      "open-in-safari"
    );
  });
  it("desktop without a native event → none", () => {
    expect(path({})).toBe("none");
  });
});
