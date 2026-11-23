import { Capacitor, registerPlugin } from "@capacitor/core";

/* -------------------------------------------------------------------------- */
/*  The iPhone's edge swipe back, in the app (backend N681 item 2).           */
/*                                                                            */
/*  The app's Navigation plugin (app 1.1, ios/App/App/Navigation.swift) turns */
/*  the web view's own back swipe on or off. It is on only where Back simply  */
/*  closes the screen on top: a full-screen overlay is open (useBackDismiss), */
/*  that overlay does not use Back for its own steps (the walk), and no Take  */
/*  is at risk (labLeaveGuard: Back there asks "Discard this take?"). Off     */
/*  everywhere else, so the swipe never slides a screen away that then snaps  */
/*  back. The website and an app without the plugin: nothing.                 */
/* -------------------------------------------------------------------------- */

interface NavigationPlugin {
  setSwipeBack(options: { enabled: boolean }): Promise<void>;
}

const Navigation = registerPlugin<NavigationPlugin>("Navigation");

const state = { topClosesOnBack: false, takeAtRisk: false };
let sent: boolean | null = null;

function available(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Navigation");
  } catch {
    return false;
  }
}

/** Whether the swipe may go back now. */
export function swipeBackAllowed(s: { topClosesOnBack: boolean; takeAtRisk: boolean }): boolean {
  return s.topClosesOnBack && !s.takeAtRisk;
}

/** Called by useBackDismiss and labLeaveGuard when their part changes. */
export function noteSwipeBack(part: Partial<typeof state>): void {
  Object.assign(state, part);
  if (!available()) return;
  const enabled = swipeBackAllowed(state);
  if (enabled === sent) return;
  sent = enabled;
  void Navigation.setSwipeBack({ enabled }).catch(() => {
    sent = null;
  });
}
