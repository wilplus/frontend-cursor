"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { fetchLibrary, type LibraryEntry } from "@/services/api/library";

/* -------------------------------------------------------------------------- */
/*  LibraryOverlay — your strong-sides library (§7)                           */
/*                                                                            */
/*  A read-only collection of the coach's curated notes on your tagged         */
/*  moments — the same human-authored lines the Lounge librarian replays.      */
/*  Never trajectory/profiling; just the notes + their strong / to-work-on tag.*/
/* -------------------------------------------------------------------------- */

export default function LibraryOverlay({ onClose }: { onClose: () => void }) {
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

  // §7a: strengths-only gallery — a VIEW filter, never an ingest filter. The
  // store (fetchLibrary) keeps to_work_on entries so the bot can surface them on
  // pull and session notes can reference them; only this gallery shows `strong`.
  const strong = entries.filter((e) => e.tag === "strong");

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
        ) : strong.length === 0 ? (
          <p className="max-w-sm text-[15px] text-muted-foreground">
            Nothing here yet — your coach&apos;s notes on your strongest moments
            collect here as you get reads.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {strong.map((e) => (
              <li key={e.id} className="rounded-2xl border border-border bg-card p-4">
                {e.tag ? (
                  <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {e.tag === "strong" ? "Strong" : "To work on"}
                  </span>
                ) : null}
                {e.note ? (
                  <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">
                    {e.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
