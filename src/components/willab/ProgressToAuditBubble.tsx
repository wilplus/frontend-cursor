"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchBestPresentationProgress,
  type BestPresentationProgress,
} from "@/services/api/bestPresentation";
import { readExploreArc } from "@/lib/willab/exploreArc";

/* -------------------------------------------------------------------------- */
/*  ProgressToAuditBubble — the take counter toward the full training (#6)     */
/*                                                                            */
/*  Arc mode only (explore takes in progress):                                */
/*    Polls GET /api/v2/explore/arc/<arc_id>/progress → takes_done / target.  */
/*    ready === false → "To complete the full training you need N more takes" */
/*                      + the progress bar. NOTHING else (#6 exact copy).      */
/*    ready === true  → renders null: the BE's terminal card                   */
/*                      (best_presentation_ready / transcript_ready) is the    */
/*                      single source of the deliverable affordances (#1).     */
/*                                                                            */
/*  Hides entirely when there is no active arc (no localStorage entry) or     */
/*  when the progress endpoint returns null (not shipped yet / error).        */
/* -------------------------------------------------------------------------- */

export default function ProgressToAuditBubble({
  arcId: arcIdProp = null,
  onReadyForCoach,
}: {
  /** Durable arc id (from the persisted recording_summary metadata) so the
   *  bubble stays clickable across logout/login + any device. When absent,
   *  falls back to the localStorage explore arc (pre-fix recordings). */
  arcId?: string | null;
  /** R4-7 — fired once when this arc reaches "all takes done, awaiting coach"
   *  (ready && !coachFinalized). The host posts the persistent "relax" bubble
   *  (guarded once-per-arc). */
  onReadyForCoach?: (arcId: string) => void;
}) {
  // Prefer the durable arc id; fall back to the localStorage arc (read once).
  const localArcRef = useRef(readExploreArc());
  const arcId = arcIdProp ?? localArcRef.current?.arcId ?? null;

  const [arcProgress, setArcProgress] = useState<BestPresentationProgress | null>(null);
  // R4-3 — the server /progress read lags the just-recorded take (BE re-parents
  // the take into an arc, so a poll can still report the pre-take count). The
  // upload response's authoritative take index is persisted to the explore arc
  // (nextTakeIndex - 1 = the take just recorded), so use it as a numerator floor
  // for THIS arc until the server catches up. Result: the 2nd take shows 2/3.
  const [localTakesFloor, setLocalTakesFloor] = useState<number | null>(null);

  useEffect(() => {
    if (!arcId) return;
    let active = true;
    const readFloor = () => {
      const la = readExploreArc();
      setLocalTakesFloor(
        la && la.arcId === arcId ? Math.max(0, la.nextTakeIndex - 1) : null
      );
    };
    const load = () => {
      readFloor();
      void fetchBestPresentationProgress(arcId).then((p) => {
        // Keep the last good value on a transient null (network blip) so the
        // bubble never flickers away once shown.
        if (active && p) setArcProgress(p);
      });
    };
    load();
    // Refetch when the user returns to the tab / app (e.g. after recording a
    // take in the lab overlay) so the bubble flips to "ready" without a reload.
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [arcId]);

  // R4-7 — fire the "all takes done, coach is up" notice once, when this arc
  // first reaches ready && !coachFinalized. The host guards it per-arc across
  // reloads and posts the persistent "relax" bubble.
  const readyFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!arcId || !arcProgress) return;
    if (arcProgress.ready && !arcProgress.coachFinalized && readyFiredRef.current !== arcId) {
      readyFiredRef.current = arcId;
      onReadyForCoach?.(arcId);
    }
  }, [arcId, arcProgress, onReadyForCoach]);

  if (!arcId || !arcProgress) return null;

  const { takesDone, takesTarget, ready, coachFinalized } = arcProgress;

  // Once the coach has assembled the ideal text, the BE's terminal card
  // (best_presentation_ready) owns the affordance — the bubble steps aside.
  if (ready && coachFinalized) return null;

  // R4-3 — show the higher of the server count and the just-recorded floor
  // (clamped to the target), so a lagging poll never under-counts the take.
  const shownDone = Math.min(
    takesTarget,
    Math.max(takesDone, localTakesFloor ?? 0)
  );
  const pct = Math.round((shownDone / takesTarget) * 100);
  // F8 — strong-sides styling: white card + fleur-de-lis. At 3/3 with the coach
  // not yet finished, add the "waiting for the coach" line (no bar, it's full).
  const waitingForCoach = ready && !coachFinalized;

  return (
    <div className="mr-auto flex max-w-[85%] flex-col gap-2 rounded-2xl rounded-tl-sm border border-border bg-background px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[15px] leading-relaxed text-foreground">
        <span className="shrink-0 text-primary" aria-hidden>
          ⚜︎
        </span>
        {shownDone}/{takesTarget} takes to complete
      </p>
      {waitingForCoach ? (
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          Now we are waiting for the coach to assemble your speech!
        </p>
      ) : (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress to your ideal text"
          />
        </div>
      )}
    </div>
  );
}
