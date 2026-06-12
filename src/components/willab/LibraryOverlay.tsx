"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  fetchStrengths,
  type StrengthMoment,
  type StrengthsView,
} from "@/services/api/strengths";
import { SlideRender } from "./pdfSlides";
import { useBackDismiss } from "./useBackDismiss";

/* -------------------------------------------------------------------------- */
/*  LibraryOverlay — your strong-sides page (§7 / §7b)                         */
/*                                                                            */
/*  Slide-grouped strengths off GET /v2/user/strengths (BE PR #76):            */
/*    • General strengths — strong moments from no-deck trainings, flat.        */
/*    • One section per slide-based training (newest first), labelled by topic:  */
/*      every deck slide rendered (PDF page / text card) with its strong moments  */
/*      under it, best (rank 1) first. Slides with no strong moment are KEPT —    */
/*      a nudge to train that one again. Each moment keeps the playable clip +    */
/*      transcript + the coach's note. Read-only; never profiling.              */
/* -------------------------------------------------------------------------- */

const EMPTY: StrengthsView = { general: [], trainings: [] };

export default function LibraryOverlay({ onClose }: { onClose: () => void }) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [view, setView] = useState<StrengthsView>(EMPTY);

  useEffect(() => {
    let active = true;
    void fetchStrengths().then((v) => {
      if (!active) return;
      setView(v);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

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
            {/* General strengths — moments from no-deck trainings. */}
            {view.general.length > 0 ? (
              <section className="flex flex-col gap-3">
                <h2 className="text-[15px] font-semibold text-foreground">
                  General strengths
                </h2>
                <ul className="flex flex-col gap-3">
                  {view.general.map((m, i) => (
                    <MomentCard key={i} moment={m} />
                  ))}
                </ul>
              </section>
            ) : null}

            {/* One section per slide-based training: walk the deck, each slide
                with its strong moments (best first); empty slides stay as a
                nudge to train them again. */}
            {view.trainings.map((t) => (
              <section key={t.sessionId} className="flex flex-col gap-4">
                <h2 className="text-[15px] font-semibold text-foreground">
                  {t.topic || t.titleSlide?.title || "Presentation"}
                </h2>
                {t.slides.map((s) => (
                  <div key={s.index} className="flex flex-col gap-3">
                    <SlideRender
                      presentationRef={t.presentationRef}
                      pageIndex={s.index}
                      title={s.title}
                      body={s.body}
                      className="w-full"
                    />
                    {s.moments.length > 0 ? (
                      <ul className="flex flex-col gap-3">
                        {s.moments.map((m, i) => (
                          <MomentCard key={i} moment={m} />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">
                        No standout moment here yet — worth another run.
                      </p>
                    )}
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
function MomentCard({ moment: m }: { moment: StrengthMoment }) {
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        Strong
      </span>
      {/* the clip: hear the moment the note is about */}
      {m.audioRef ? (
        <div className="mt-2">
          <MediaPlayer
            src={m.audioRef}
            startOffsetMs={m.startOffsetMs}
            durationMs={m.durationMs}
          />
        </div>
      ) : null}
      {/* the words you said in that clip */}
      {m.transcript ? (
        <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-[14px] italic leading-relaxed text-foreground">
          {m.transcript}
        </blockquote>
      ) : null}
      {/* the coach's note about it */}
      {m.note ? (
        <p className="mt-2 text-[15px] leading-relaxed text-foreground">
          {m.note}
        </p>
      ) : null}
    </li>
  );
}
