"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { saveSnippetSlide } from "@/services/api/snippetSlide";
import type { ReadoutSlide } from "./readout";

/* -------------------------------------------------------------------------- */
/*  SnippetSlideCorrection — the coach's word→slide ground truth               */
/*  (founder 2026-08-11)                                                       */
/*                                                                            */
/*  services/slide_boundary_metrics.py has said it since the day it was       */
/*  written: there is no ground truth for word→slide bucketing, and "the only  */
/*  real labels available are COACH CORRECTIONS". This control is where a      */
/*  human makes one.                                                          */
/*                                                                            */
/*  THE QUESTION IS THE WHOLE DESIGN. It asks what was ON SCREEN, not what     */
/*  the words were about, because the north star defines the bucketing as     */
/*  "every word bucketed to the slide on screen when it was spoken". A         */
/*  speaker who ran ahead of their own deck is NOT a bucketing error, and a    */
/*  corpus that books it as one teaches the opposite of the thing it exists    */
/*  to measure. So the copy names the screen, every time, and the withdraw     */
/*  option says "the pipeline was right" rather than "clear" — because that    */
/*  is also a label, and a rarer one than a correction.                       */
/*                                                                            */
/*  Coach-only, like everything on this card (AC-9): no number reaches a user  */
/*  surface, and this is the coach's own judgment, never a model's guess.      */
/* -------------------------------------------------------------------------- */

export default function SnippetSlideCorrection({
  snippetId,
  slides,
  mappedIndex,
}: {
  snippetId: string;
  /** The whole deck, in order — including slides nobody spoke a word on,
   *  which is exactly where a forgotten advance stranded the words. */
  slides: readonly ReadoutSlide[];
  /** What the pipeline mapped this snippet to, or null when it had no
   *  answer (no timeline, no deck). */
  mappedIndex: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | "withdraw" | null>(null);
  // What the coach last said HERE. Null = they have not corrected in this
  // session of the card; the pipeline's answer stands.
  const [corrected, setCorrected] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (slides.length === 0) return null;

  async function send(next: number | null) {
    if (busy !== null) return;
    setBusy(next === null ? "withdraw" : next);
    setError(null);
    const r = await saveSnippetSlide(snippetId, next);
    setBusy(null);
    if (!r.ok) {
      setError(r.error ?? "Couldn't save that. Try again.");
      return;
    }
    setCorrected(next);
    setSaved(true);
    setOpen(false);
    setTimeout(() => setSaved(false), 2000);
  }

  const shown = corrected ?? mappedIndex;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span>
          On screen:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {shown === null ? "not known" : `Slide ${shown + 1}`}
          </span>
        </span>
        {corrected !== null ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
            Corrected
          </span>
        ) : null}
        {saved ? (
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Saved
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="underline underline-offset-2 transition-colors hover:text-foreground"
        >
          {open ? "Close" : "Wrong slide?"}
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          {/* The question, in full. Short enough to read mid-review, exact
              enough that the corpus means one thing. */}
          <p className="text-[12px] leading-snug text-muted-foreground">
            Which slide was on screen while this was said? Go by what the
            audience was looking at, not by what the words are about.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {slides.map((sl, i) => {
              const isShown = shown === i;
              return (
                <button
                  key={`${i}-${sl.title.slice(0, 8)}`}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void send(i)}
                  title={sl.title || `Slide ${i + 1}`}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[13px] tabular-nums transition-colors disabled:opacity-50 ${
                    isShown
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {busy === i ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    i + 1
                  )}
                </button>
              );
            })}
          </div>
          {corrected !== null ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void send(null)}
              className="self-start text-[12px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground disabled:opacity-50"
            >
              {busy === "withdraw"
                ? "Withdrawing…"
                : "Actually, the pipeline was right"}
            </button>
          ) : null}
          {error ? (
            <p className="text-[12px] text-destructive">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
