import { bffFetch } from "@/lib/api/bffFetch";
import { isNativeApp } from "@/lib/auth/nativeSignIn";
import { sameSitePath } from "@/lib/auth/sameSitePath";
import { closeNativeDump } from "@/lib/phone/dumpScreen";
import { whenNoTakeAtRisk } from "@/components/willab/labLeaveGuard";

/* -------------------------------------------------------------------------- */
/*  Push in the iPhone app (backend N385, N365 item 4): "The feedback from     */
/*  your coach is in!" and a new chat message, sent by the backend through     */
/*  Apple (services/push_devices.py). In the app only; the website is as it    */
/*  was.                                                                       */
/*                                                                            */
/*  iOS asks its own question once. It comes after the speaker has first seen  */
/*  their coach's feedback (N385 item 2), on the next open of the app, so it   */
/*  never pops over the Feedback walk itself. A no is iOS's to keep; nothing   */
/*  asks again. Once allowed, every open hands Apple's address to the backend  */
/*  (it can change), and a tapped push opens the page it names; while a Take   */
/*  is not yet on the server, once it is (N560 item 3).                        */
/* -------------------------------------------------------------------------- */

const FEEDBACK_SEEN = "willab.push.feedbackSeen";
const TOKEN = "willab.push.token";
const DEVICE = "/api/v2/user/push-device";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the next open asks or registers again */
  }
}

/** The speaker has seen their coach's feedback: iOS's question may come. */
export function noteFeedbackSeen(): void {
  if (isNativeApp()) write(FEEDBACK_SEEN, "1");
}

/** On each open of the app, signed in: register when allowed, ask once when
 *  the first feedback has been seen, open the page a tapped push names.
 *  Returns the cleanup. */
export async function startNativePush(): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const handles = await Promise.all([
    PushNotifications.addListener("registration", ({ value }) => {
      write(TOKEN, value);
      void bffFetch(DEVICE, { method: "POST", json: { token: value } });
    }),
    PushNotifications.addListener("registrationError", (err) => {
      console.warn("[push] registration failed", err);
    }),
    PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      closeNativeDump(); // a tapped notification never lands on the dump screen (N506 item 4)
      const path = sameSitePath(String((notification.data as { path?: unknown })?.path ?? ""));
      if (!path) return;
      // While a Take is not yet on the server, the page opens once it is (N560 item 3).
      whenNoTakeAtRisk(() => {
        if (path !== window.location.pathname + window.location.search) window.location.assign(path);
      });
    }),
  ]);
  let { receive } = await PushNotifications.checkPermissions();
  if (receive === "prompt" && read(FEEDBACK_SEEN)) {
    ({ receive } = await PushNotifications.requestPermissions());
  }
  if (receive === "granted") await PushNotifications.register();
  return () => handles.forEach((h) => void h.remove());
}

/** Sign-out: this phone stops getting the account's pushes. */
export async function forgetPushDevice(): Promise<void> {
  const token = read(TOKEN);
  if (!isNativeApp() || !token) return;
  write(TOKEN, null);
  await bffFetch(DEVICE, { method: "DELETE", json: { token } });
}
