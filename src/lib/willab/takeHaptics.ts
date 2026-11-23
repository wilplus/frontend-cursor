import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNativeApp } from "@/lib/auth/nativeSignIn";

/* -------------------------------------------------------------------------- */
/*  The recording moments you feel (backend N678 item 1), in the iPhone app   */
/*  only: a medium tick when recording starts, a light tick on Next slide and */
/*  Back, a success tick on Finish take, a warning tick on Discard take.      */
/*  Never seen or heard; the browser and the home-screen app stay silent. A   */
/*  phone that refuses says nothing and the Take goes on.                     */
/* -------------------------------------------------------------------------- */

export type TakeMoment = "start" | "slide" | "finish" | "discard";

export function takeHaptic(moment: TakeMoment): void {
  if (!isNativeApp()) return;
  const tick =
    moment === "start"
      ? Haptics.impact({ style: ImpactStyle.Medium })
      : moment === "slide"
        ? Haptics.impact({ style: ImpactStyle.Light })
        : Haptics.notification({ type: moment === "finish" ? NotificationType.Success : NotificationType.Warning });
  void tick.catch(() => undefined);
}
