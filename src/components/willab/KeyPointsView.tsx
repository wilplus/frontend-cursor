"use client";

import type { KeyPoint } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  KeyPointsView (E-2, FE-7) — the key-words presentation mode, shared by the  */
/*  readout and the full-screen ideal-text overlay. Renders the verbatim cues   */
/*  in the array's order, each as its own card. Tapping a cue returns to the    */
/*  full read. Presentation only — the host owns the toggle + the data.         */
/*                                                                            */
/*  FE-7 — the BE used to return exactly one cue for a whole talk (a deckless   */
/*  project produced one milestone per block, and there is only ever one        */
/*  block). BE-3 fixed that at source; this side's job is to render 2-12 of     */
/*  them faithfully:                                                            */
/*                                                                            */
/*    · ONE CARD PER CUE, in the array's order. Never re-sorted.                */
/*    · block_key / block_label may be null on a paragraph-derived cue, so      */
/*      nothing here keys off them — the label is drawn when it exists and the  */
/*      card is complete without it.                                            */
/*                                                                            */
/*  THE FENCE (AC-9). No rank, no percentage, no "top 3", no confidence, and    */
/*  no ordinal — not even a 1./2./3. list marker, which reads as importance     */
/*  ordering the moment there are twelve of them. A key point is a qualitative  */
/*  cue, full stop. If a comp shows a number here, the comp is wrong.           */
/* -------------------------------------------------------------------------- */

export default function KeyPointsView({
  keyPoints,
  onExit,
}: {
  keyPoints: KeyPoint[];
  onExit: () => void;
}) {
  // key_points served but EMPTY is a real state, distinct from absent: the
  // feature is on for this document, there is just nothing to cue yet. The
  // host keeps the toggle up; this is what sits under it.
  if (keyPoints.length === 0) {
    return (
      <p className="py-10 text-center text-[13px] text-muted-foreground">
        No key words for this version yet. They arrive as your text settles.
      </p>
    );
  }
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
