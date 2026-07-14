"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import OverlayCloseButton from "./OverlayCloseButton";
import LoadingState from "./LoadingState";
import { useBackDismiss } from "./useBackDismiss";
import { fetchArcBatch, type ArcBatch } from "@/services/api/arcBatch";

/* -------------------------------------------------------------------------- */
/*  ArcBatchView — the STUDENT's batch review (R4-11).                         */
/*                                                                            */
/*  After the coach's "Publish arc": every take's coach-labelled snippets       */
/*  grouped per take, then the coach-edited ideal text at the end. Fences:      */
/*  NO say_it_stronger cards here (synonyms are instant-view only; the batch    */
/*  endpoint omits them and this view must never re-add them), and the ideal    */
/*  text is the coach-EDITED composition (L1), rendered verbatim.               */
/*                                                                            */
/*  {delivered:false} → the calm "waiting for your coach" state. A null fetch    */
/*  (endpoint not shipped / network) degrades to the same waiting state.        */
/* -------------------------------------------------------------------------- */

const TAG_LABEL: Record<"strong" | "to_work_on", string> = {
  strong: "Strong",
  to_work_on: "To work on",
};

export default function ArcBatchView({
  arcId,
  onClose,
}: {
  arcId: string;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [batch, setBatch] = useState<ArcBatch | null>(null);

  useEffect(() => {
    let active = true;
    void fetchArcBatch(arcId).then((b) => {
      if (!active) return;
      setBatch(b);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, [arcId]);

  const delivered = batch?.delivered === true ? batch : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-medium text-foreground">
          Coach review
        </span>
        <OverlayCloseButton onClick={onClose} />
      </div>

      {status === "loading" ? (
        <div className="flex flex-1 items-center justify-center">
          <LoadingState />
        </div>
      ) : !delivered ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
          <p className="text-[17px] font-semibold text-foreground">
            Your coach is still working on this one
          </p>
          <p className="max-w-sm text-[15px] text-muted-foreground">
            When the full review is ready it will appear here. Nothing for you
            to do in the meantime.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-5">
            {delivered.takes.map((take) => (
              <section key={take.sessionId}>
                <h3 className="text-[12px] font-medium uppercase tracking-wider text-primary">
                  Take {take.takeIndex}
                </h3>
                {take.snippets.length === 0 ? (
                  <p className="mt-2 text-[14px] text-muted-foreground">
                    No highlighted moments on this take.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-col gap-3">
                    {take.snippets.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-border bg-card p-4"
                      >
                        {s.tag ? (
                          <span
                            className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              s.tag === "strong"
                                ? "bg-success/10 text-success"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {TAG_LABEL[s.tag]}
                          </span>
                        ) : null}
                        <p className="text-[15px] leading-relaxed text-foreground">
                          {s.transcript}
                        </p>
                        {s.coachNote ? (
                          <p className="mt-3 border-t border-border pt-3 text-[14px] leading-relaxed text-muted-foreground">
                            {s.coachNote}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}

            {/* The coach-edited ideal text closes the batch (L1: verbatim). */}
            {delivered.idealSlides.length > 0 ? (
              <section className="border-t border-border pt-5">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                  <Crown className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                  Your ideal presentation
                </h3>
                <div className="mt-3 flex flex-col gap-4">
                  {delivered.idealSlides.map((slide) => (
                    <div key={slide.index}>
                      {slide.title ? (
                        <p className="text-[13px] font-medium text-muted-foreground">
                          {slide.title}
                        </p>
                      ) : null}
                      <p className="mt-1 whitespace-pre-wrap text-[16px] leading-relaxed text-foreground">
                        {slide.text}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
