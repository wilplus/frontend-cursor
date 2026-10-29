"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WalkStep } from "@/lib/willab/walkPlan";
import type { FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import type { WalkQuote } from "@/services/api/walkQuote";

/* -------------------------------------------------------------------------- */
/*  The walk quotes your notebook (backend N268; docs/flows/principles.md §1  */
/*  R; the walk's C5). While the speaker practises a Clearer version, the     */
/*  Take's one quote is asked for, so it is ready by the Good job; the walk   */
/*  never waits for it, and one that lands later shows when it lands. At     */
/*  most one per Take. "Not here" hides it at once and keeps the notebook    */
/*  out of every later walk (the backend's setting).                         */
/* -------------------------------------------------------------------------- */

export type WalkQuoteIO = {
  ask: (said: string) => Promise<WalkQuote | null>;
  shown: () => void;
  notHere: () => void;
  /** A walk played again: the quote it already showed. */
  replay?: () => Promise<WalkQuote | null>;
};

export type WalkQuotes = {
  /** The quote under moment `moment`'s Good job; null: none. */
  quoteOf: (moment: number) => WalkQuote | null;
  /** "Not here" was tapped in this walk. */
  notHere: boolean;
  tapNotHere: () => void;
  /** The quote reached the screen: told to the backend once. */
  shown: () => void;
};

export function useWalkQuote<R>({
  io,
  plan,
  at,
  moments,
}: {
  io: WalkQuoteIO | null | undefined;
  plan: readonly WalkStep[];
  at: number;
  moments: readonly FeedbackWalkMoment<R>[];
}): WalkQuotes {
  const [quotes, setQuotes] = useState<Record<number, WalkQuote>>({});
  const [notHere, setNotHere] = useState(false);
  const asked = useRef(false);
  const told = useRef(false);
  const step = plan[at];
  const moment = step?.moment != null ? moments[step.moment] : undefined;
  const said = moment?.clearer?.said ?? null;
  const practising = step?.key === "practise" && !step.replay && (step.kind === "words" || step.kind === "keep");
  useEffect(() => {
    if (!io || !practising || !said || !moment || asked.current) return;
    asked.current = true;
    const index = moment.index;
    void io
      .ask(said)
      .then((q) => {
        if (q && q.said === said) setQuotes((all) => ({ ...all, [index]: q }));
        else asked.current = false; // none for this sentence: another may get the Take's one
      })
      .catch(() => {
        asked.current = false;
      });
  }, [io, practising, said, moment]);
  // A walk played again shows the quote it showed, on its sentence.
  const replay = io?.replay;
  useEffect(() => {
    if (!replay) return;
    let on = true;
    void replay()
      .then((q) => {
        const m = q ? moments.find((x) => x.clearer?.said === q.said) : undefined;
        if (on && q && m) {
          asked.current = true;
          told.current = true;
          setQuotes((all) => ({ ...all, [m.index]: { ...q, first: false } }));
        }
      })
      .catch(() => undefined);
    return () => {
      on = false;
    };
    // Once per walk opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay]);
  const quoteOf = useCallback((m: number) => quotes[m] ?? null, [quotes]);
  const shown = useCallback(() => {
    if (told.current || !io) return;
    told.current = true;
    io.shown();
  }, [io]);
  const tapNotHere = useCallback(() => {
    setNotHere(true);
    io?.notHere();
  }, [io]);
  return { quoteOf, notHere, tapNotHere, shown };
}
