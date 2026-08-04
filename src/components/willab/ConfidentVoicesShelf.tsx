"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import {
  fetchConfidentVoices,
  type ConfidentVoice,
} from "@/services/api/reflectionGame";

/* -------------------------------------------------------------------------- */
/*  ConfidentVoicesShelf — the Confident Voices library entry + overlay        */
/*  (F2 §1e, founder decision 2026-08-03: cross-project, coach-verified        */
/*  moments only)                                                              */
/*                                                                            */
/*  Self-contained: fetches once on mount and renders NOTHING while the        */
/*  library is empty or the endpoint is absent — the Trainings hub looks        */
/*  exactly as today until the first coach-verified moment exists. AC-9        */
/*  standing rule: no counts on the entry card, no aggregates in the list;     */
/*  the album is a list of the user's own verified moments and nothing else.   */
/* -------------------------------------------------------------------------- */

export default function ConfidentVoicesShelf() {
  const [items, setItems] = useState<ConfidentVoice[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchConfidentVoices().then((v) => {
      if (live) setItems(v);
    });
    return () => {
      live = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4 pb-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-left transition hover:border-primary/60"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate text-[15px] font-medium text-foreground">
              Confident voices
            </span>
          </span>
          <ChevronDown
            className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground"
            aria-hidden
          />
        </button>
      </div>
      {open ? (
        <ConfidentVoicesOverlay items={items} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

/** The album itself: one card per coach-verified moment, newest first
 *  (server-ordered) — playback + the project it came from. */
function ConfidentVoicesOverlay({
  items,
  onClose,
}: {
  items: ConfidentVoice[];
  onClose: () => void;
}) {
  // Same back-gesture contract as every overlay: Back closes THIS layer.
  useBackDismiss(onClose);
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Confident voices
        </span>
        <OverlayCloseButton onClick={onClose} />
      </div>
      <div className="scrollbar-none flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
          {items.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-3 rounded-2xl border border-border px-4 py-4"
            >
              {m.topic ? (
                <p className="text-[13px] font-medium text-muted-foreground">
                  {m.topic}
                </p>
              ) : null}
              <MediaPlayer
                src={m.audioRef}
                startOffsetMs={m.startOffsetMs}
                durationMs={m.durationMs}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
