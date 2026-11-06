"use client";

import { useEffect, useRef, useState } from "react";
import DumpScreen from "./DumpScreen";
import { useRingState } from "@/hooks/useRingState";
import { EMPTY_RING_STATE } from "@/services/api/rings";
import { getNotebookState, type NotebookState } from "@/services/api/voiceNotebook";
import { DUMP_COPY, DUMP_FEATURE, opensFirstNow, setDumpOpener, setOpenFirst } from "@/lib/willab/dumpScreen";
import { backDismissDepth } from "./useBackDismiss";
import { nativeDump, onNativeKept, onNativeSent, openNativeDump, syncApp } from "@/lib/phone/dumpScreen";
import { LOUNGE_THREAD_MERGED_EVENT } from "@/lib/funnel/loungeLocalThread";
import { isNativeApp } from "@/lib/auth/nativeSignIn";

/* -------------------------------------------------------------------------- */
/*  THE IPHONE APP'S ONLY (backend N540 item 1): in a browser, the website   */
/*  and the website saved to a home screen alike, it never opens: not first, */
/*  and not by the pull (no opener is registered, so the top bar does not    */
/*  pull). The notebook itself is unchanged everywhere.                      */
/*                                                                            */
/*  When the dump screen opens first (backend N506 item 4, N522): only on a  */
/*  plain open of the app (no link: `plain` is false when the address names   */
/*  a Take, a walk or an Ideal Text), only when its ring row and the          */
/*  notebook are on, only when the person turned "Open to the dump screen"   */
/*  on, and then on every open and every coming back to the app. Will's     */
/*  chat is underneath, untouched (Never 3). Never over the loop: while a    */
/*  recording, the wait, the Ideal Text or the walk is open (any overlay),   */
/*  it waits for the next open (opensFirstNow; backend N540 item 2).         */
/*                                                                            */
/*  In the iPhone app with the native screen (N506 item 5) this tells the    */
/*  app what it knows (each time the chat opens, so a flip of the switch in */
/*  Settings reaches it too), and once the notebook has its Yes the app's   */
/*  own screen opens first instead of this one. Before the Yes, this web    */
/*  screen opens as everywhere, with the introduction (N507 item 1).        */
/*                                                                            */
/*  A pull down from the top bar opens it at any time (N517): the same       */
/*  screen, the app's own where it can, with no hourly limit.                */
/* -------------------------------------------------------------------------- */

export default function DumpScreenHost({ plain }: { plain: boolean }) {
  const ring = useRingState();
  const on = ring?.featuresOn.has(DUMP_FEATURE) === true && isNativeApp();
  const [notebook, setNotebook] = useState<NotebookState | null>(null);
  const [open, setOpen] = useState(false);
  const [keptNote, setKeptNote] = useState(false);
  // A ring read that failed comes back empty: unknown, not "off", so the
  // app is not told to switch its screen off (it must work offline).
  const ringKnown = ring !== null && ring !== EMPTY_RING_STATE && !ring.unavailable;

  // The notebook as last read, so a pull opens at once, with no wait (N517).
  const known = useRef<NotebookState | null>(null);
  const sync = () =>
    void syncApp(on).then((state) => {
      if (state) known.current = state;
    });

  useEffect(() => {
    if (ringKnown) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sync` reads `on`, listed
  }, [ringKnown, on]);

  useEffect(() => onNativeKept(() => setKeptNote(true)), []);
  // A native dump reached the backend: Will's chat reads it now, so its
  // "Noted." shows without waiting for the next reload.
  useEffect(() => onNativeSent(() => window.dispatchEvent(new Event(LOUNGE_THREAD_MERGED_EVENT))), []);

  useEffect(() => {
    if (!on) return;
    let live = true;
    const show = async (state: NotebookState | null) => {
      if (!live || !state?.enabled) return;
      if (state.consented && (await openNativeDump())) return;
      if (!live) return;
      setNotebook(state);
      setOpen(true);
    };
    setDumpOpener(() => {
      // Known: open now. Not yet read: read, then open.
      if (known.current) void show(known.current);
      else void getNotebookState().then(show);
    });
    return () => {
      live = false;
      setDumpOpener(null);
    };
  }, [on]);

  useEffect(() => {
    if (!on || !plain) return;
    let live = true;
    const consider = () => {
      if (!opensFirstNow(backDismissDepth())) return;
      void getNotebookState().then((state) => {
        // Asked again as the answer lands: a screen of the loop may have
        // opened while the notebook was read.
        if (!live || !state?.enabled || !opensFirstNow(backDismissDepth())) return;
        if (state.consented && nativeDump()) return; // the app's own screen opens first
        setNotebook(state);
        setOpen(true);
      });
    };
    consider();
    const back = () => {
      if (document.visibilityState === "visible") consider();
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", back);
    };
  }, [on, plain]);

  useEffect(() => {
    if (!keptNote) return;
    const t = window.setTimeout(() => setKeptNote(false), 2000);
    return () => window.clearTimeout(t);
  }, [keptNote]);

  return (
    <>
      {open && notebook ? (
        <DumpScreen
          needsConsent={!notebook.consented}
          onClose={(kept) => {
            setOpen(false);
            setKeptNote(kept);
            sync(); // after the first Yes, the app's screen takes over
          }}
          onDecline={() => {
            setOpenFirst(false);
            setOpen(false);
            sync();
          }}
        />
      ) : null}
      {keptNote ? (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-[max(64px,env(safe-area-inset-top))] z-[81] -translate-x-1/2 rounded-full bg-foreground px-3.5 py-1.5 text-[12.5px] text-background"
        >
          {DUMP_COPY.kept}
        </div>
      ) : null}
    </>
  );
}
