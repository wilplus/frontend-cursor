"use client";

import { useEffect } from "react";
import { useSignedIn } from "@/components/willab/useSignedIn";
import { startNativePush } from "@/lib/nativePush";

/* Push in the iPhone app (backend N385), started once signed in: see
 * src/lib/nativePush.ts. On the web it does nothing. Renders nothing. */
export default function NativePush() {
  const signedIn = useSignedIn();
  useEffect(() => {
    if (signedIn !== true) return;
    let stop: (() => void) | null = null;
    let gone = false;
    void startNativePush()
      .then((cleanup) => (gone ? cleanup() : (stop = cleanup)))
      .catch((err) => console.warn("[push] not started", err));
    return () => {
      gone = true;
      stop?.();
    };
  }, [signedIn]);
  return null;
}
