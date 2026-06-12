"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  fetchLibrary,
  groupStrongSides,
  type LibraryEntry,
} from "@/services/api/library";
import { SlideRender } from "./pdfSlides";
import { useBackDismiss } from "./useBackDismiss";

/* -------------------------------------------------------------------------- */
/*  LibraryOverlay — your strong-sides library (§7 / §7b)                      */
/*                                                                            */
/*  A read-only collection of the coach's curated notes on your strongest      */
/*  moments — the human-authored lines the Lounge librarian replays. Never     */
/*  trajectory/profiling; just the note + the playable clip + transcript.      */
/*                                                                            */
/*  §7b — slide-grouped view: "General strengths" (moments from no-deck         */
/*  trainings) first, then one group per slide-based training (newest first),   */
/*  each slide rendered with its top-3 strong moments by rank under it. Falls   */
/*  back to a single General list when the BE carries no per-moment slide/rank  */
/*  (every moment is then "general").                                          */
/* -------------------------------------------------------------------------- */

export default function LibraryOverlay({ onClose }: { onClose: () => void }) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [entries, setEntries] = useState<LibraryEntry[]>([]);

  useEffect(() => {
    let active = true;
    void fetchLibrary().then((e) => {
      if (!active) return;
      setEntries(e);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  // Strengths-only is a VIEW filter (the store keeps to_work_on so the bot can
  // still surface it); groupStrongSides drops it and shapes the rest into the
  // General list + per-slide training groups.
  const view = useMemo(() => groupStrongSides(entries), [entries]);
  const isEmpty = view.general.length === 0 && view.trainings.length === 0;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[13px] font-semibold text-foreground">
          Your strong sides
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the library"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-6">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          <p className="max-w-sm text-[15px] text-muted-foreground">
            Nothing here yet — your coach&apos;s notes on your strongest moments
            collect here as you get reads.
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            {/* General strengths — moments with no slide (no-deck trainings). */}
            {view.general.length > 0 ? (
              <section className="flex flex-col gap-3">
                <h2 className="text-[15px] font-semibold text-foreground">
                  General strengths
                </h2>
                <ul className="flex flex-col gap-3">
                  {view.general.map((e) => (
                    <MomentCard key={e.id} entry={e} />
                  ))}
                </ul>
              </section>
            ) : null}

            {/* One group per slide-based training: the slide, then its top
                strong moments on that slide (best first). */}
            {view.trainings.map((t) => (
              <section key={t.sessionId} className="flex flex-col gap-4">
                <h2 className="text-[15px] font-semibold text-foreground">
                  {t.topic || "Presentation"}
                </h2>
                {t.slides.map((g) => (
                  <div key={g.slide.index} className="flex flex-col gap-3">
                    <SlideRender
                      presentationRef={t.presentationRef}
                      pageIndex={g.slide.index}
                      title={g.slide.title}
                      body={g.slide.body}
                      className="w-full"
                    />
                    <ul className="flex flex-col gap-3">
                      {g.moments.map((e) => (
                        <MomentCard key={e.id} entry={e} />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** One strong moment: the Strong tag, the playable clip, the words you said,
 *  and the coach's note about it. Shared by the General list + each slide. */
function MomentCard({ entry: e }: { entry: LibraryEntry }) {
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        Strong
      </span>
      {/* the clip: hear the moment the note is about */}
      {e.snippet?.audioRef ? (
        <div className="mt-2">
          <MediaPlayer
            src={e.snippet.audioRef}
            startOffsetMs={e.snippet.startOffsetMs}
            durationMs={e.snippet.durationMs}
          />
        </div>
      ) : null}
      {/* the words you said in that clip */}
      {e.snippet?.transcript ? (
        <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-[14px] italic leading-relaxed text-foreground">
          {e.snippet.transcript}
        </blockquote>
      ) : null}
      {/* the coach's note about it */}
      {e.note ? (
        <p className="mt-2 text-[15px] leading-relaxed text-foreground">
          {e.note}
        </p>
      ) : null}
    </li>
  );
}
