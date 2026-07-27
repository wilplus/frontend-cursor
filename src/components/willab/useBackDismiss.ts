import { useEffect, useRef } from "react";

/* -------------------------------------------------------------------------- */
/*  useBackDismiss — the device Back gesture closes an overlay (D-3)           */
/*                                                                            */
/*  willab overlays are state-based, NOT routes (the always-mounted hub stays   */
/*  put underneath them — architecture invariant). The cost: the iPhone         */
/*  left-edge back-swipe / browser Back runs a real history navigation, so with */
/*  nothing on the stack it walks OFF /chat (e.g. to the signup / welcome       */
/*  screen) instead of just closing the overlay.                                */
/*                                                                            */
/*  Fix: when the overlay opens, push a throwaway history entry. A popstate      */
/*  (Back) then pops an entry and the overlay closes — the hub underneath never  */
/*  unloads, the URL never changes.                                             */
/*                                                                            */
/*  STACKING (R7 fix): popstate is window-GLOBAL — every mounted overlay hears   */
/*  every pop. Without coordination, one overlay's close cascades: its           */
/*  balancing back() fires the other overlays' handlers and collapses the whole  */
/*  stack (roster → student → ideal panel all closing at once). Two rules fix    */
/*  it, tracked through a module-level LIFO of mounted dismissers:               */
/*    1. Only the TOP of the stack acts on a popstate; deeper overlays ignore    */
/*       it (their turn comes when they are on top).                             */
/*    2. The unmount cleanup only pops its own throwaway entry when it is the    */
/*       LAST overlay. With overlays still underneath, the entry is left in      */
/*       place — the user's next Back consumes it and closes the (new) top       */
/*       overlay, which is exactly the LIFO behavior they expect. No balancing   */
/*       pop → nothing to cascade.                                              */
/*                                                                            */
/*  Call once at the top of an overlay that mounts when open and unmounts when   */
/*  closed. EVERY full-screen overlay must use this hook (an inline popstate     */
/*  listener would bypass the stack and reintroduce the cascade).               */
/*                                                                            */
/*  Optional `onBack`: an overlay with internal layout states (e.g. a paged      */
/*  list) can intercept Back to step ONE state back instead of closing. Return   */
/*  true to "consume" the Back (we re-arm a history entry so the next Back is    */
/*  still catchable); return false to let it close as usual.                     */
/* -------------------------------------------------------------------------- */

/** Module-level LIFO of mounted overlay dismissers (tokens). The top entry is
 *  the visually-top overlay — the only one allowed to act on a popstate. */
const dismissStack: symbol[] = [];

/** How many throwaway entries this module currently has on the history stack.
 *  Needed because a HAND-OFF can leave more than one outstanding (see the
 *  deferred cleanup below), and they must all come off in a single go(-n)
 *  rather than one dead Back press per stray. */
let outstandingEntries = 0;

function removeFromStack(token: symbol): void {
  const i = dismissStack.lastIndexOf(token);
  if (i >= 0) dismissStack.splice(i, 1);
}

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
    const token = Symbol("backDismiss");
    dismissStack.push(token);
    // True once a Back/swipe (popstate) has already popped an entry for us. The
    // unmount cleanup must then NOT call back() again — a second pop would walk
    // PAST /chat (e.g. to /login, which can sit in the stack).
    let closedByPopstate = false;
    window.history.pushState({ __willabOverlay: true }, "");
    outstandingEntries++;
    const onPop = () => {
      // Not the top overlay → not our pop. The top one closes; we stay put
      // (rule 1 — this is what stops one pop collapsing the whole stack).
      if (dismissStack[dismissStack.length - 1] !== token) return;
      // Give the overlay a chance to step its own internal layout state back.
      if (onBackRef.current && onBackRef.current()) {
        // Consumed → re-arm an entry so the next Back is still interceptable.
        window.history.pushState({ __willabOverlay: true }, "");
        return;
      }
      closedByPopstate = true;
      outstandingEntries = Math.max(0, outstandingEntries - 1);
      removeFromStack(token);
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      removeFromStack(token);
      // Closed via X / unmount with our entry still on the history stack:
      // pop it ourselves ONLY when we are the last overlay (no stranded dead
      // entry on the hub). With overlays still underneath, leave the entry —
      // the next Back consumes it and closes the new top overlay (rule 2);
      // popping here would fire THEIR handlers and cascade-close them.
      // Skip after a Back-close (the browser already popped) and when
      // navigating FORWARD (the suppressor — else we'd cancel that very
      // navigation).
      if (closedByPopstate || navigatingAwayRef.current) return;

      // DEFERRED ON PURPOSE. One overlay HANDING OFF to another — the project
      // picker unmounting as the Lab mounts — is a single React commit: this
      // cleanup runs, then the incoming overlay's effect runs. Popping here,
      // synchronously, meant the stack looked empty (we had just left, the
      // next one had not yet arrived), so we called back()… and the popstate
      // landed on the INCOMING overlay's listener and closed it. From the user
      // that reads as "I picked a project and nothing happened", which is the
      // whole record flow.
      //
      // A microtask runs after React has flushed the commit's effects, so by
      // then the incoming overlay is on the stack and we correctly leave the
      // history alone. Its own entry is then one too many, which is what
      // outstandingEntries tracks: whoever is genuinely last takes them all off
      // in one go(-n), so a hand-off never strands a dead Back press either.
      queueMicrotask(() => {
        if (dismissStack.length > 0) return; // handed off — not our business
        if (outstandingEntries <= 0) return;
        const n = outstandingEntries;
        outstandingEntries = 0;
        window.history.go(-n);
      });
    };
  }, []);

  // Call this immediately before triggering a forward navigation that will
  // unmount the overlay (e.g. router.push("/signup")), so the unmount cleanup
  // does NOT history.back() over it.
  return () => {
    navigatingAwayRef.current = true;
  };
}
