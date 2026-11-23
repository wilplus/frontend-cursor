import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/* -------------------------------------------------------------------------- */
/*  Dark mode in the iPhone app (backend N678 item 2, N680).                  */
/*                                                                            */
/*  The app is pinned to light, so its web view cannot see the iPhone's own   */
/*  setting. Its Appearance plugin (app version 1.1, ios/App/App/              */
/*  Appearance.swift) answers what the iPhone is set to, says when that       */
/*  changes, and puts the app's own parts (status bar, keyboard, the web      */
/*  view's ground) in the style the page uses. Dark only while the ring row   */
/*  `dark_mode` is on (the founder first). The website and an app without the */
/*  plugin stay light.                                                         */
/* -------------------------------------------------------------------------- */

export const DARK_MODE_FEATURE = "dark_mode";

export type Style = "light" | "dark";

export interface AppearancePlugin {
  /** What the iPhone itself is set to, whatever the app shows. */
  system(): Promise<{ style: Style }>;
  /** Puts the app's own parts in this style. */
  use(options: { style: Style }): Promise<void>;
  addListener(event: "systemChange", listener: (e: { style: Style }) => void): Promise<PluginListenerHandle>;
}

export const Appearance = registerPlugin<AppearancePlugin>("Appearance");

export function appearanceAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Appearance");
  } catch {
    return false;
  }
}

/** The style the app shows: dark only with the plugin, the ring row on and
 *  the iPhone set to dark. */
export function chosenStyle(opts: { ringOn: boolean; system: Style | null }): Style {
  return opts.ringOn && opts.system === "dark" ? "dark" : "light";
}

/** Shows a style: <html class="dark"> for the page, then the app's own parts. */
export async function applyStyle(style: Style, plugin: Pick<AppearancePlugin, "use"> = Appearance): Promise<void> {
  document.documentElement.classList.toggle("dark", style === "dark");
  try {
    await plugin.use({ style });
  } catch {
    /* the page is already right; the status bar keeps its own */
  }
}
