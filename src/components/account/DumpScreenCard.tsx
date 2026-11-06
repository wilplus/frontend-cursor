"use client";

/* -------------------------------------------------------------------------- */
/*  "Open to the dump screen", in Data & consent (backend N507 item 2, the    */
/*  founder's OK for this one row of a locked page). Off by default. Shown    */
/*  only while the ring row `dump_screen` is on for the person. Kept on this  */
/*  device: opening first is about this phone. The screen and its rules:      */
/*  components/willab/DumpScreen, lib/willab/dumpScreen. Only in the iPhone   */
/*  app (backend N540 item 1): a browser has no dump screen, so no switch.    */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { useRingState } from "@/hooks/useRingState";
import { isNativeApp } from "@/lib/auth/nativeSignIn";
import { DUMP_COPY as COPY, DUMP_FEATURE, openFirst, setOpenFirst } from "@/lib/willab/dumpScreen";

export default function DumpScreenCard() {
  const ring = useRingState();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(openFirst()), []);

  if (ring?.featuresOn.has(DUMP_FEATURE) !== true || !isNativeApp()) return null;

  const flip = () => {
    setOpenFirst(!on);
    setOn(!on);
  };

  return (
    <section className="mt-6 rounded-2xl border border-border p-5" aria-label={COPY.switchLabel}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{COPY.switchLabel}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{COPY.switchLine}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={COPY.switchLabel}
          onClick={flip}
          className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${on ? "bg-foreground" : "bg-[#d9d9d9]"}`}
        >
          <span
            className={`absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : ""}`}
            aria-hidden
          />
        </button>
      </div>
    </section>
  );
}
