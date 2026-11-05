import { Capacitor, registerPlugin } from "@capacitor/core";
import { readNotebookState, type NotebookState } from "@/services/api/voiceNotebook";
import { openFirst } from "@/lib/willab/dumpScreen";

/* -------------------------------------------------------------------------- */
/*  The dump screen in the iPhone app (backend N506 item 5, N507): native,    */
/*  the capture screen only (ios/App/App/Dump/, DumpScreenPlugin in            */
/*  WillpowerLabBridge.swift). The web stays the owner of the switch: it      */
/*  tells the app whether the screen is on for this person (the ring row,    */
/*  the notebook's Yes, "Open to the dump screen") and hears "kept" to show   */
/*  "Kept". The first time, with N411's introduction, stays on the web        */
/*  screen. An app without the plugin gets the web screen.                    */
/* -------------------------------------------------------------------------- */

interface DumpScreenNative {
  configure(o: { enabled: boolean; openFirst: boolean }): Promise<void>;
  open(): Promise<{ opened?: boolean }>;
  close(): Promise<void>;
  addListener(e: "kept", fn: () => void): Promise<{ remove: () => Promise<void> }>;
}
const DumpScreen = registerPlugin<DumpScreenNative>("DumpScreen");

/** In the iPhone app, in a version that has the native screen. */
export function nativeDump(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("DumpScreen");
  } catch {
    return false;
  }
}

/** Reads the notebook once (when the chat opens) and tells the app what the
 *  web knows: on only with the ring row and the notebook's Yes. When the
 *  notebook could not be read (no network), the app is told nothing and
 *  keeps what it had: offline the native screen must still open and keep
 *  what is said. Answers the notebook's state, so a pull opens at once with
 *  no wait (N517); null when off or when it could not be read. */
export async function syncApp(ringOn: boolean): Promise<NotebookState | null> {
  const state = ringOn ? await readNotebookState() : null;
  if (!nativeDump() || (ringOn && state === null)) return state;
  const enabled = ringOn && state?.enabled === true && state.consented === true;
  await DumpScreen.configure({ enabled, openFirst: openFirst() }).catch(() => undefined);
  return state;
}

/** Opens the app's own screen; false when it could not (no plugin, or the
 *  app has not heard the screen is on), so the web screen opens instead. */
export async function openNativeDump(): Promise<boolean> {
  if (!nativeDump()) return false;
  try {
    return (await DumpScreen.open()).opened === true;
  } catch {
    return false;
  }
}

/** A tapped notification opens its page: the native screen gets out of the way. */
export function closeNativeDump(): void {
  if (nativeDump()) void DumpScreen.close().catch(() => undefined);
}

/** "Kept" from the native screen. Returns the cleanup. */
export function onNativeKept(fn: () => void): () => void {
  if (!nativeDump()) return () => {};
  const handle = DumpScreen.addListener("kept", fn);
  return () => void handle.then((h) => h.remove()).catch(() => undefined);
}
