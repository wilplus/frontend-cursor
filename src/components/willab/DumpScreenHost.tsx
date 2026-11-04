"use client";

import { useEffect, useState } from "react";
import DumpScreen from "./DumpScreen";
import { useRingState } from "@/hooks/useRingState";
import { getNotebookState, type NotebookState } from "@/services/api/voiceNotebook";
import { DUMP_COPY, DUMP_FEATURE, dueToOpen, markShown, setOpenFirst } from "@/lib/willab/dumpScreen";

/* -------------------------------------------------------------------------- */
/*  When the dump screen opens first (backend N506 item 4, N507): only on a   */
/*  plain open of the app (no link: `plain` is false when the address names   */
/*  a Take, a walk or an Ideal Text), only when its ring row and the          */
/*  notebook are on, only when the person turned "Open to the dump screen"   */
/*  on, and at most once an hour, also on coming back to the app. Will's     */
/*  chat is underneath, untouched (Never 3).                                 */
/* -------------------------------------------------------------------------- */

export default function DumpScreenHost({ plain }: { plain: boolean }) {
  const ring = useRingState();
  const on = ring?.featuresOn.has(DUMP_FEATURE) === true;
  const [notebook, setNotebook] = useState<NotebookState | null>(null);
  const [open, setOpen] = useState(false);
  const [keptNote, setKeptNote] = useState(false);

  useEffect(() => {
    if (!on || !plain) return;
    let live = true;
    const consider = () => {
      if (!dueToOpen(Date.now())) return;
      void getNotebookState().then((state) => {
        if (!live || !state?.enabled) return;
        setNotebook(state);
        markShown(Date.now());
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
          }}
          onDecline={() => {
            setOpenFirst(false);
            setOpen(false);
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
