import { useEffect, useSyncExternalStore } from "react";

/* -------------------------------------------------------------------------- */
/*  A screen over the list that opens like a chat: while it is open the       */
/*  site's bar ("WillpowerLab" and the menu) is hidden, as it is under a      */
/*  person's chat (the AI models, backend N632 item 6).                       */
/* -------------------------------------------------------------------------- */

let covers = 0;
const listeners = new Set<() => void>();

function publish(): void {
  listeners.forEach((listen) => listen());
}

function subscribe(listen: () => void): () => void {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

/** Hides the site's bar while the calling screen is drawn. */
export function useCoverSiteBar(): void {
  useEffect(() => {
    covers += 1;
    publish();
    return () => {
      covers -= 1;
      publish();
    };
  }, []);
}

/** Drawn with a screen that opens like a chat: the site's bar is hidden
 *  while it is (the setup and "Test my chat", the founder's trial). */
export function CoverSiteBar(): null {
  useCoverSiteBar();
  return null;
}

/** True while some screen covers the site's bar. */
export function useSiteBarCovered(): boolean {
  return useSyncExternalStore(subscribe, () => covers > 0, () => false);
}
