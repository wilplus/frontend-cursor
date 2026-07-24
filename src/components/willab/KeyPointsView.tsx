"use client";

import type { KeyPoint } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  KeyPointsView (E-2) — the key-words presentation mode, shared by the        */
/*  readout and the full-screen ideal-text overlay. Renders the verbatim cues   */
/*  in order, each under its block label. Tapping a cue returns to the full     */
/*  read (the exact scroll-to-offset via start/end is a later refinement).      */
/*  Presentation only — the host owns the toggle + the data.                    */
/* -------------------------------------------------------------------------- */

export default function KeyPointsView({
  keyPoints,
  onExit,
}: {
  keyPoints: KeyPoint[];
  onExit: () => void;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {keyPoints.map((kp, i) => (
        <li key={`${kp.blockKey ?? "b"}-${i}`}>
          <button
            type="button"
            onClick={onExit}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
          >
            {kp.blockLabel ? (
              <span className="block text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {kp.blockLabel}
              </span>
            ) : null}
            <span className="mt-1 block text-[17px] font-medium leading-snug text-foreground">
              {kp.text}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
