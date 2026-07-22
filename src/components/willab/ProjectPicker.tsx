"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";

/* -------------------------------------------------------------------------- */
/*  ProjectPicker — context-aware recording setup, Scenario A (founder         */
/*  2026-07-22).                                                              */
/*                                                                            */
/*  Recording from the dashboard asks ONE question first: is this a new topic  */
/*  or another take of something you already have? Deliberately plain — the    */
/*  titles are a list of words, no cards, no thumbnails, no take counts, no    */
/*  dates. `cover_ref` / `take_count` / `created_at` are all ignored even      */
/*  though the payload carries them.                                          */
/*                                                                            */
/*  "Start a new topic" is a BUTTON above the list, never a list item, so      */
/*  starting fresh can never be mistaken for continuing something.            */
/*                                                                            */
/*  One title == one project == one arc == one ideal text. Picking a title     */
/*  continues THAT arc (its setup prefills, its master document grows); the    */
/*  new-topic path is today's blank flow, untouched.                          */
/* -------------------------------------------------------------------------- */

export default function ProjectPicker({
  onNewTopic,
  onContinue,
  onClose,
}: {
  /** Today's blank setup flow, unchanged. */
  onNewTopic: () => void;
  /** Continue this project — the caller seeds the arc and opens setup. */
  onContinue: (arc: TrainingArc) => void;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  const [arcs, setArcs] = useState<TrainingArc[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchTrainings().then((r) => {
      if (!active) return;
      setArcs(r);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Only projects with a real title are offerable — an untitled arc cannot be
  // told apart from another in a list of words.
  const titled = (arcs ?? []).filter((a) => a.topic.trim().length > 0);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/70 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-medium text-foreground">
          What are you recording?
        </span>
        <OverlayCloseButton onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-8">
          <Button
            type="button"
            onClick={onNewTopic}
            className="h-12 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Start a new topic
          </Button>

          {/* The list only exists once there is something to continue. */}
          {loaded && titled.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="px-1 pb-1 text-[13px] text-muted-foreground">
                Or another take of:
              </p>
              {titled.map((a) => (
                <button
                  key={a.arcId}
                  type="button"
                  onClick={() => onContinue(a)}
                  className="rounded-xl px-3 py-3 text-left text-[16px] leading-snug text-foreground transition-colors hover:bg-muted"
                >
                  {a.topic}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
