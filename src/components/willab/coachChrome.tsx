"use client";

import type { ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/*  coachChrome — the presentational vocabulary BOTH coach lanes share          */
/*                                                                            */
/*  There are two coach feedback lanes, and they stay separate SURFACES        */
/*  (N1 / BLIND COACH):                                                        */
/*    - the BLIND labeler   the walk's Judge screen (CoachJudgeInstrument)    */
/*                                                                            */
/*  Separate surfaces, not separate design languages. Both lanes were drawing  */
/*  the same pill, badge, eyebrow, error line and card from scratch. The star  */
/*  lane's local VerdictPill even carried a comment saying it copied the       */
/*  labeler's chip idiom "plus aria-pressed" — which is exactly how the        */
/*  labeler ended up the only one of the two WITHOUT aria-pressed. Copying a   */
/*  chip by hand loses whichever detail the copier did not notice.             */
/*                                                                            */
/*  THIS FILE IS NOT A BRIDGE. It imports from neither lane, and it holds no   */
/*  vocabulary belonging to either one: no direction labels, no star families,  */
/*  no devices, no verdicts. Shared CHROME only. If a machine guess could      */
/*  reach the blind flow through a shared module, the fence would be worth     */
/*  nothing, so the separation test asserts this file imports neither lane.     */
/*                                                                            */
/*  Founder decision 2026-07-30: "unify the plumbing, keep the surfaces        */
/*  separate." The moment something lane-specific lands in here, that decision */
/*  has been quietly reversed — put it in the lane that owns it instead.       */
/* -------------------------------------------------------------------------- */

/** A save failure, in the one voice both lanes use. `inline` for the labeler's
 *  status footer (it trails other text in a row); block otherwise. */
export function CoachErrorLine({
  children,
  inline = false,
  className = "",
}: {
  children: ReactNode;
  inline?: boolean;
  className?: string;
}) {
  const cls = `text-[12px] text-destructive ${className}`;
  return inline ? (
    <span className={cls}>{children}</span>
  ) : (
    <p className={cls}>{children}</p>
  );
}
