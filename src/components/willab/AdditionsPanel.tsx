"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RichText } from "./RichText";
import { IDEAL_EDIT_COPY as C } from "./idealEditCopy";
import type { Addition } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  AdditionsPanel — MATERIAL RECOVERY.                                        */
/*                                                                            */
/*  Words the speaker SAID, on a slide their script has no block for. The      */
/*  master document's structure locks on take 1: one block per slide spoken    */
/*  on. Speak on a slide that was skipped then, or add a slide to the deck     */
/*  afterwards, and those words match no block — so they are held aside rather */
/*  than thrown away, and offered back here.                                   */
/*                                                                            */
/*  NOT A SUGGESTION, and that is why it is a separate surface rather than     */
/*  another tracked change. There is no span: nothing in the document to       */
/*  strike, bold or point at. It used to be forced into the tracked-change     */
/*  shape as a zero-width `insert` and was dropped by every layer that touched  */
/*  it — the FE's kind vocabulary, its `end > start` span check, and the        */
/*  manager gate's zero-width guard. All three were right; the shape was wrong. */
/*                                                                            */
/*  NOT BUDGETED either. Appendix H's max-3 is a load limit on FEEDBACK; this  */
/*  is the student's own material going missing from their own script, and     */
/*  three polish notes must not be able to swallow it.                         */
/*                                                                            */
/*  L1: every word here is verbatim what they said. Nothing is authored.       */
/* -------------------------------------------------------------------------- */

export default function AdditionsPanel({
  additions,
  onDecide,
  textSizeClass = "text-[17px]",
}: {
  additions: Addition[];
  /** Resolves true when the decision stuck. The host owns the endpoint and the
   *  refetch; a false answer leaves the card up rather than pretending. */
  onDecide: (addition: Addition, accept: boolean) => Promise<boolean>;
  textSizeClass?: string;
}) {
  // Decided locally so a card leaves immediately on a tap — the server answer
  // only ever confirms it. Keyed by id, never by index: the list reorders when
  // a newer take replaces an offer.
  const [done, setDone] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const open = additions.filter((a) => !done[a.id]);
  if (open.length === 0) return null;

  const decide = (addition: Addition, accept: boolean) => {
    if (busy) return;
    setBusy(addition.id);
    void onDecide(addition, accept).then((ok) => {
      setBusy(null);
      if (ok) setDone((prev) => ({ ...prev, [addition.id]: true }));
    });
  };

  return (
    <section className="mt-6 flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        {C.additionsHeading}
      </h3>
      {open.map((a) => (
        <div
          key={a.id}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 px-3.5 py-3"
        >
          <div className="flex items-center justify-between gap-2">
            {/* The slide these words were spoken over — provenance, not a
                verdict (AC-9). Absent when the BE cannot prove one. */}
            {a.label ? (
              <span className="text-[12px] font-medium text-muted-foreground">
                {a.label}
              </span>
            ) : (
              <span />
            )}
            {a.takeIndex !== null ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {a.takeIndex}.0
              </span>
            ) : null}
          </div>
          <p
            className={`whitespace-pre-line leading-relaxed text-foreground ${textSizeClass}`}
          >
            <RichText text={a.text} />
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => decide(a, true)}
              className="h-10 flex-1 rounded-full bg-foreground text-[14px] text-background hover:bg-foreground/90"
            >
              {C.additionAccept}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => decide(a, false)}
              className="h-10 flex-1 rounded-full text-[14px]"
            >
              {C.additionDecline}
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
