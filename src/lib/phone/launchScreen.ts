import { Capacitor } from "@capacitor/core";

/* The iPhone app's launch screen stays until the page has drawn (backend
 * N661 item 2), so no blank white page shows between the mark and the chat.
 * The app holds it for at most a few seconds on its own (capacitor.config.ts,
 * `launchShowDuration`); the site ends it sooner here, once what is on screen
 * is the page and not a full-screen wait. A browser, the home-screen app and
 * an app version without the plugin have no launch screen to hide: nothing
 * runs for them. */

/** The full-screen wait's mark (LoadingState, placement "viewport"). */
export const VIEWPORT_WAIT = "[data-viewport-wait]";

/** How long the site keeps watching for the page to draw. The app's own
 *  limit has passed by then, so there is nothing left to hide. */
export const WATCH_MS = 8000;

let hidden = false;

function inAppWithLaunchScreen(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("SplashScreen");
  } catch {
    return false;
  }
}

/** Is the page on screen, and not a full-screen wait? */
export function pageHasDrawn(doc: Document): boolean {
  return doc.querySelector(VIEWPORT_WAIT) === null;
}

/** Hide the launch screen, once. Never throws. */
export function hideLaunchScreen(): void {
  if (hidden || !inAppWithLaunchScreen()) return;
  hidden = true;
  void import("@capacitor/splash-screen")
    .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 150 }))
    .catch(() => undefined);
}

/** Watch the page and hide the launch screen when it has drawn. Returns the
 *  function that stops watching. */
export function watchLaunchScreen(doc: Document, win: Window): () => void {
  if (hidden || !inAppWithLaunchScreen()) return () => undefined;
  let frame = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
    observer.disconnect();
    win.clearTimeout(limit);
    if (frame) win.cancelAnimationFrame(frame);
  };
  // After the next paint, so the page is on screen before the mark leaves.
  const check = () => {
    if (stopped || frame) return;
    frame = win.requestAnimationFrame(() => {
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        if (stopped || !pageHasDrawn(doc)) return;
        hideLaunchScreen();
        stop();
      });
    });
  };
  const observer = new MutationObserver(check);
  observer.observe(doc.body, { childList: true, subtree: true });
  const limit = win.setTimeout(stop, WATCH_MS);
  check();
  return stop;
}

/** For tests. */
export function resetLaunchScreen(): void {
  hidden = false;
}
