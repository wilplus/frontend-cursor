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
/*                                                                            */
/*  Optional `onBack`: an overlay with internal layout states (e.g. an expanded */
/*  section, a paged list) can intercept Back to step ONE state back instead of  */
/*  closing. Return true to "consume" the Back (we re-arm a history entry so the */
/*  next Back is still catchable); return false to let it close as usual.        */
/* -------------------------------------------------------------------------- */

export function useBackDismiss(
  onClose: () => void,
  onBack?: () => boolean
): () => void {
  // Keep the latest callbacks without re-running the effect (a new closure each
  // render must NOT push a fresh history entry).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  // Set true by the returned suppressor RIGHT BEFORE the overlay unmounts
  // because we're navigating FORWARD (e.g. to /signup). Without this, the
  // cleanup's history.back() (below) would immediately reverse that forward
  // navigation and dump the user back on /chat — the "sign-in goes to chat,
  // not sign-up" bug. Ref (not state) so the flag is readable synchronously
  // inside the cleanup on the same tick the caller sets it.
  const navigatingAwayRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // True once a Back/swipe (popstate) has already popped our entry. The
    // unmount cleanup must then NOT call back() again — a second pop would walk
    // PAST /chat (e.g. to /login, which can sit in the stack). Tracking the
    // close cause is more robust than inspecting window.history.state, which is
    // unreliable when overlays stack.
    let closedByPopstate = false;
    window.history.pushState({ __willabOverlay: true }, "");
    const onPop = () => {
      // Give the overlay a chance to step its own internal layout state back.
      if (onBackRef.current && onBackRef.current()) {
        // Consumed → re-arm an entry so the next Back is still interceptable.
        window.history.pushState({ __willabOverlay: true }, "");
        return;
      }
      closedByPopstate = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed via X / unmount: our pushed entry is still on top → pop it so we
      // don't strand a dead entry. After a Back-close the browser already popped
      // it, so we skip (else we'd over-pop past /chat). And when we're
      // navigating FORWARD (suppressor called), skip too — else we'd cancel the
      // very navigation that just fired.
      if (!closedByPopstate && !navigatingAwayRef.current) {
        window.history.back();
      }
    };
  }, []);

  // Call this immediately before triggering a forward navigation that will
  // unmount the overlay (e.g. router.push("/signup")), so the unmount cleanup
  // does NOT history.back() over it.
  return () => {
    navigatingAwayRef.current = true;
  };
}
