"use client";

import { useEffect } from "react";
import { useSignedIn } from "@/components/willab/useSignedIn";
import { isNativeApp } from "@/lib/auth/nativeSignIn";

/* Push in the iPhone app (backend N385), started once signed in: see
 * src/lib/nativePush.ts. On the web it does nothing. Renders nothing.
 *
 * nativePush.ts is imported here only in the app: it pulls the dump screen's
 * bridge and the notebook's API client with it, which every web page (and
 * /login, signed out) used to download for a function that returned at once
 * off the phone. In the app it is one small chunk, the push plugin's own
 * import (already lazy) right behind it, and /chat usually has it loaded. */
export default function NativePush() {
  const signedIn = useSignedIn();
  useEffect(() => {
    if (signedIn !== true || !isNativeApp()) return;
    let stop: (() => void) | null = null;
    let gone = false;
    void import("@/lib/nativePush")
      .then(({ startNativePush }) => startNativePush())
      .then((cleanup) => (gone ? cleanup() : (stop = cleanup)))
      .catch((err) => console.warn("[push] not started", err));
    return () => {
      gone = true;
      stop?.();
    };
  }, [signedIn]);
  return null;
}
