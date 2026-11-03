"use client";

import { useEffect } from "react";
import { startNativeLinks } from "@/lib/nativeLinks";

/* willpowerlab.com links open in the iPhone app (backend N365 item 5): see
 * src/lib/nativeLinks.ts. Signed in or not, since an invite link comes before
 * the account. On the web it does nothing. Renders nothing. */
export default function NativeLinks() {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let gone = false;
    void startNativeLinks()
      .then((cleanup) => (gone ? cleanup() : (stop = cleanup)))
      .catch((err) => console.warn("[links] not started", err));
    return () => {
      gone = true;
      stop?.();
    };
  }, []);
  return null;
}
