// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * STORY   As a speaker opening the iPhone app, I want the mark to stay until
 *         the page is there, so that I never look at a blank white screen.
 * OUTCOME
 *   O1  In the app, the launch screen leaves once the page has drawn, and
 *       stays while a full-screen wait is still on screen.
 *   O2  In a browser there is no launch screen: nothing is called.
 * PROVES  O1 -> "the launch screen stays through a full-screen wait and leaves when the page has drawn"
 *         O2 -> "a browser has no launch screen to hide"
 * WHY     Founder 2026-11-17 (backend N661 item 2).
 */

const { hide, app } = vi.hoisted(() => ({
  hide: vi.fn(async (_o: unknown) => undefined),
  app: { native: true },
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => app.native, isPluginAvailable: () => app.native },
}));
vi.mock("@capacitor/splash-screen", () => ({ SplashScreen: { hide } }));

import { resetLaunchScreen, watchLaunchScreen } from "./launchScreen";

/** Long enough for the two frames the watcher waits, and its import. */
const drawn = () => new Promise((done) => setTimeout(done, 80));

describe("the iPhone app's launch screen", () => {
  beforeEach(() => {
    hide.mockClear();
    resetLaunchScreen();
    app.native = true;
    document.body.innerHTML = "";
  });

  it("the launch screen stays through a full-screen wait and leaves when the page has drawn", async () => {
    document.body.innerHTML = '<div data-viewport-wait=""></div>';
    const stop = watchLaunchScreen(document, window);
    await drawn();
    expect(hide).not.toHaveBeenCalled();

    document.body.innerHTML = "<main>The chats</main>";
    await drawn();
    expect(hide).toHaveBeenCalledTimes(1);
    stop();
  });

  it("a browser has no launch screen to hide", async () => {
    app.native = false;
    document.body.innerHTML = "<main>The chats</main>";
    const stop = watchLaunchScreen(document, window);
    await drawn();
    expect(hide).not.toHaveBeenCalled();
    stop();
  });
});
