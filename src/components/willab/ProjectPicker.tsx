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
/*                                                                            */
/*  FE-4 (2026-07-27) — NO DEFAULTS, EVER. There is no last-used project, no   */
/*  auto-select when the list holds exactly one entry, and no "continue where  */
/*  you left off". Every entry into recording asks. This is not a UX           */
/*  preference: a take submitted with the wrong continue_arc_id lands in the   */
/*  wrong project, which splits the arc and corrupts the cross-take comparison */
/*  the ideal text is ranked across. Silence here is a data defect.            */
/*                                                                            */
/*  With NO projects there is nothing to choose between, so the screen is a    */
/*  single centred "Start your first project" — one thing, nothing competing.  */
/* -------------------------------------------------------------------------- */

export default function ProjectPicker({
  onNewTopic,
  onContinue,
  onSkip,
  onClose,
}: {
  /** Today's blank setup flow, unchanged. CLEARS the arc seed. */
  onNewTopic: () => void;
  /** Continue this project — the caller seeds the arc and opens setup. */
  onContinue: (arc: TrainingArc) => void;
  /** There is nothing to choose between: go straight on WITHOUT clearing the
   *  seed. Never route this to onNewTopic — a seeded in-project entry would
   *  lose its arc (review R-pp7/R-pp8). */
  onSkip: () => void;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  const [arcs, setArcs] = useState<TrainingArc[]>([]);
  // Three-way, so "still loading" and "couldn't load" are never mistaken for
  // "you have no projects" — that mistake steers the student into starting a
  // new topic when they meant to continue one (review R-pp3/R-pp6).
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void fetchTrainings().then((r) => {
      if (!active) return;
      if (r === null) {
        setStatus("error");
        return;
      }
      setArcs(r);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  // Only projects with a real title are offerable — an untitled arc cannot be
  // told apart from another in a list of words.
  const titled = arcs.filter((a) => a.topic.trim().length > 0);

  // Arcs exist but none carry a title: there is nothing to put in a list of
  // words, so skip the question rather than leave "Start a new topic" as the
  // only answer — that would WIPE a seeded arc and mint a duplicate project
  // (review R-pp7). Deliberately onSkip, not onNewTopic: this must not clear
  // the seed. The error state is NOT this case; it keeps its retry below.
  const untitledOnly = status === "ready" && arcs.length > 0 && titled.length === 0;
  useEffect(() => {
    if (untitledOnly) onSkip();
  }, [untitledOnly, onSkip]);
  if (untitledOnly) return null;

  // FE-4 — a genuinely first-time user: GET /v2/user/trainings came back
  // {trainings: []}. Gated on `arcs`, not `titled`, so an untitled-project
  // account never lands here and loses its seed to the new-topic path.
  const firstProject = status === "ready" && arcs.length === 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-end px-4">
        <OverlayCloseButton onClick={onClose} />
      </div>

      {firstProject ? (
        // One button, centred, and nothing else on the screen with it.
        <div className="flex flex-1 items-center justify-center px-5 pb-16">
          <Button
            type="button"
            onClick={onNewTopic}
            className="h-12 w-full max-w-xs rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
          >
            Start your first project
          </Button>
        </div>
      ) : (
      <div className="scrollbar-none flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-8">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              New recording
            </p>
            <h2 className="mt-1.5 text-[22px] font-semibold leading-snug text-foreground">
              What are you recording?
            </h2>
          </div>
          <Button
            type="button"
            onClick={onNewTopic}
            className="h-12 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Start a new topic
          </Button>

          {status === "loading" ? (
            <p className="px-1 text-[13px] text-muted-foreground">
              Looking for your projects…
            </p>
          ) : status === "error" ? (
            // Unreachable is NOT "you have no projects" — offer the retry
            // rather than steer someone into starting a duplicate topic
            // (review R-pp3/R-pp6).
            <div className="flex flex-col items-start gap-2 px-1">
              <p className="text-[13px] text-muted-foreground">
                Couldn&apos;t load your projects.
              </p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="text-[13px] text-foreground underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : null}
          {/* The list only exists once there is something to continue. */}
          {status === "ready" && titled.length > 0 ? (
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
      )}
    </div>
  );
}
