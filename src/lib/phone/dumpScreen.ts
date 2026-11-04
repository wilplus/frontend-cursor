import { Capacitor, registerPlugin } from "@capacitor/core";
import { getNotebookState } from "@/services/api/voiceNotebook";
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

/** Tells the app what the web knows: on only with the ring row and the
 *  notebook's Yes. Answers the notebook's state, or null outside the app. */
export async function syncApp(ringOn: boolean): Promise<{ consented: boolean } | null> {
  if (!nativeDump()) return null;
  const state = ringOn ? await getNotebookState() : null;
  const enabled = ringOn && state?.enabled === true && state.consented === true;
  await DumpScreen.configure({ enabled, openFirst: openFirst() }).catch(() => undefined);
  return { consented: state?.consented === true };
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
