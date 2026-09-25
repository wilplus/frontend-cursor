"use client";

/* -------------------------------------------------------------------------- */
/*  Choosing the exercise that sits on the machine's moment.                  */
/*                                                                            */
/*  FOUNDER 2026-09-25, and the scope matters: the Feedback Manager picks the */
/*  MOMENT, the coach picks the EXERCISE. Each Take carries at most one       */
/*  exercise (contract 24f) and `attach_exercise_offer` already enforces it   */
/*  on the speaker side, so nothing here adds a second one or moves it to     */
/*  another clip — that would exceed the versioned budget (L2). The coach     */
/*  only chooses what fills the one slot the Manager opened.                  */
/*                                                                            */
/*  IN A FILE OF ITS OWN because CoachConfidencePracticeReview is             */
/*  grandfathered at the complexity ratchet and may only shrink. Everything   */
/*  that branches lives here, so the sheet gains a component and a hook call  */
/*  and nothing it would have to count.                                       */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useId, type ReactNode } from "react";
import type { CoachPracticeExercise } from "@/services/api/coachConfidencePractice";

/** Only a plausible exercise id is ever read back — it arrives in the URL. */
const EXERCISE_ID = /^[A-Za-z0-9_-]{1,120}$/;

/** The exercise the CMS handed back for THIS moment, or null.
 *
 *  The CMS returns `attach=<id>` (see `withAttachedExercise`) and the review
 *  handed off with `for=<snippetId>`. Both must be present and the moment must
 *  match: an `attach` with no `for`, or one made for a different clip, is
 *  ignored rather than applied to whichever practice happens to render. */
export function pendingAttachFor(search: string, snippetId: string): string | null {
  try {
    const params = new URLSearchParams(search);
    const id = (params.get("attach") ?? "").trim();
    if (!id || !EXERCISE_ID.test(id)) return null;
    return params.get("for") === snippetId ? id : null;
  } catch {
    return null;
  }
}

/** Drop the hand-back from the address bar, so a reload cannot re-apply it. */
function forgetPendingAttach(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("attach");
    url.searchParams.delete("for");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    /* A history that refuses the write only means a reload re-selects it. */
  }
}

/** Preselect the exercise the coach just made, once the list has loaded.
 *
 *  PRESELECT, NEVER SAVE. The coach still presses the button that shares it —
 *  arriving back must not act on their behalf.
 *
 *  AND NEVER SILENTLY. The list only holds exercises that are published with
 *  their video (`get_active_diagnostic_exercise` is the gate), so one saved as
 *  a draft comes back absent. Skipping it quietly is the failure mode fixed on
 *  this same path on 2026-09-24 — the coach would think it was chosen — so
 *  `onMissing` lets the sheet say so. */
export function usePendingAttach(
  snippetId: string,
  available: CoachPracticeExercise[] | null,
  onFound: (item: CoachPracticeExercise) => void,
  onMissing: () => void,
): void {
  useEffect(() => {
    if (!available) return;
    const id = pendingAttachFor(window.location.search, snippetId);
    if (!id) return;
    // Forget first: every later run of this effect then finds nothing, so the
    // fresh callbacks each render passes in can never apply it twice.
    forgetPendingAttach();
    const item = available.find((exercise) => exercise.exerciseId === id);
    if (item) onFound(item);
    else onMissing();
  }, [snippetId, available, onFound, onMissing]);
}

/** Said when the exercise the coach just made comes back missing from the list. */
const NOT_YET_PUBLISHED =
  "The exercise you just made isn’t here yet. Only exercises published with their video can be chosen.";

/** The sheet's setters, handed over so every choosing branch lives here. */
export interface ExerciseChoiceSetters {
  setMode: (mode: "library" | "custom") => void;
  setId: (exerciseId: string) => void;
  setNotice: (notice: string | null) => void;
  setVideo: (url: string) => void;
}

/** One way to choose an exercise — the coach tapping it, or the CMS handing it
 *  back — and the hook that applies the hand-back. Returns the chooser for the
 *  list to call.
 *
 *  The setters arrive destructured so the callbacks depend on the setters
 *  themselves, which React keeps stable, and not on the object literal the
 *  sheet builds on every render. */
export function useExerciseChoice(
  snippetId: string,
  practice: { availableExercises: CoachPracticeExercise[] } | null,
  { setMode, setId, setNotice, setVideo }: ExerciseChoiceSetters,
): (item: CoachPracticeExercise) => void {
  const choose = useCallback(
    (item: CoachPracticeExercise) => {
      setMode("library");
      setId(item.exerciseId);
      setNotice(null);
      if (item.explanationVideoRef) setVideo(item.explanationVideoRef);
    },
    [setMode, setId, setNotice, setVideo],
  );
  const missing = useCallback(() => setNotice(NOT_YET_PUBLISHED), [setNotice]);
  usePendingAttach(snippetId, practice?.availableExercises ?? null, choose, missing);
  return choose;
}

/** Every reviewed exercise, visible, one chosen.
 *
 *  It replaces a <select>, which hid the whole library behind the one title
 *  already chosen — the coach could not see what else existed without opening
 *  it (founder 2026-09-25: "it's just a list of exercises plus an add
 *  button"). A radio group rather than buttons, because exactly one is
 *  chosen and assistive tech should say so. */
export function ExercisePickList({
  exercises,
  selectedId,
  onPick,
  notice,
}: {
  exercises: CoachPracticeExercise[];
  selectedId: string;
  onPick: (item: CoachPracticeExercise) => void;
  notice: string | null;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-[13px] font-medium text-foreground">
        Reviewed exercise
      </p>
      {notice ? (
        <p role="status" className="text-[12.5px] leading-snug text-muted-foreground">
          {notice}
        </p>
      ) : null}
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2">
        {exercises.map((item) => {
          const chosen = item.exerciseId === selectedId;
          return (
            <button
              key={item.exerciseId}
              type="button"
              role="radio"
              aria-checked={chosen}
              onClick={() => onPick(item)}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left ${
                chosen ? "border-primary bg-primary/5" : "border-border bg-background"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-foreground">
                  {item.title}
                </span>
                {item.instruction ? (
                  <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-muted-foreground">
                    {item.instruction}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full border text-[11px] ${
                  chosen
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border"
                }`}
              >
                {chosen ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The door into the exercise lane.
 *
 *  With a review behind it, it goes through the review's own hand-off, which
 *  brings the coach back to THIS moment with the new exercise already chosen
 *  (founder 2026-09-25). Without one — where no review queue hosts the sheet —
 *  it stays the plain link it always was. The sheet still passes the address
 *  and the words, so what the door says and where it leads remain the sheet's
 *  to state; only the choice between the two moved here. */
export function AddToLibraryDoor({
  href,
  snippetId,
  onBuild,
  children,
}: {
  href: string;
  snippetId: string;
  onBuild?: (snippetId: string) => void;
  children: ReactNode;
}) {
  const look =
    "rounded-full border border-border bg-background px-4 py-2 text-[13px] font-medium text-foreground";
  if (onBuild) {
    return (
      <button type="button" onClick={() => onBuild(snippetId)} className={look}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} className={`${look} no-underline`}>
      {children}
    </a>
  );
}
