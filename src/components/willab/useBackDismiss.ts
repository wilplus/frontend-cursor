import { useEffect, useRef } from "react";

/* -------------------------------------------------------------------------- */
/*  useBackDismiss — the device Back gesture closes an overlay (D-3)           */
/*                                                                            */
/*  willab overlays are state-based, NOT routes (the always-mounted hub stays   */
/*  put underneath them — architecture invariant). The cost: the iPhone         */
/*  left-edge back-swipe / browser Back runs a real history navigation, so with */
/*  nothing on the stack it walks OFF /chat (e.g. to the signup / welcome       */
/*  screen) instead of just closing the overlay. (This is the missing half of   */
/*  the wave-2 D4 fix: D4 removed the /login redirect; the overlays still didn't */
/*  intercept Back.)                                                            */
/*                                                                            */
/*  Fix: when the overlay opens, push a throwaway history entry. A popstate      */
/*  (Back) then pops THAT entry and we call onClose — the hub underneath never   */
/*  unloads, the URL never changes. If the overlay is closed by other means      */
/*  (its X / unmount) while our entry is still current, we pop it ourselves so   */
/*  we don't strand a dead entry the user would have to Back over.              */
/*                                                                            */
/*  Call once at the top of an overlay that mounts when open and unmounts when   */
/*  closed. Stacks correctly (each overlay pushes its own entry, LIFO).         */
/* -------------------------------------------------------------------------- */

export function useBackDismiss(onClose: () => void): void {
  // Keep the latest onClose without re-running the effect (a new closure each
  // render must NOT push a fresh history entry).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.pushState({ __willabOverlay: true }, "");
    const onPop = () => onCloseRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed via X / unmount (not via Back): our pushed entry is still the
      // current one → pop it to keep history balanced. After a Back-close the
      // current state is the prior entry, so this check is a no-op.
      const st = window.history.state as { __willabOverlay?: boolean } | null;
      if (st && st.__willabOverlay) window.history.back();
    };
  }, []);
}
