"use client";

import { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  Exercises, one person (founder 2026-10-18, Linear WIL-29, option 1).       */
/*                                                                            */
/*  Founder only: the backend answers 403 to any other admin, and then this    */
/*  section is not drawn at all. Counts in words, never a rate, a bar or a     */
/*  ranking colour. The machine's read, the coach's answer and the speaker's  */
/*  own answer stay on their own lines (L3). Below five practices of one      */
/*  exercise it says so, so no one reads a pattern into one or two tries.     */
/*  A speaker never sees any of this (AC-9).                                  */
/* -------------------------------------------------------------------------- */

type Counts<K extends string> = Record<K, number>;

interface ExerciseRow {
  exercise_id: string;
  title: string;
  practices: number;
  too_few: boolean;
  right_away: Counts<"better" | "not_yet" | "not_checked">;
  coach: Counts<"agreed" | "did_not" | "waiting">;
  own_answer: Counts<"yes" | "no" | "none">;
  next_take: Counts<"held" | "came_back" | "unknown" | "waiting">;
  tries: Counts<"none" | "one" | "two" | "three">;
  skipped: number;
}

interface Effects {
  too_few_below: number;
  exercises: ExerciseRow[];
}

/** "2 better · 1 not yet": the non-zero parts, in the order given. */
function parts(pairs: [number, string][]): string {
  const shown = pairs.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
  return shown.length ? shown.join(" · ") : "—";
}

export default function ExerciseEffects({ id }: { id: string }) {
  const [data, setData] = useState<Effects | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/v2/admin/people/${encodeURIComponent(id)}/practice-effects`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: Effects | null) => live && setData(body && Array.isArray(body.exercises) ? body : null))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [id]);

  if (!data) return null;

  const row = "grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-3 py-1.5 text-sm";
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">Exercises</h2>
      <div className="grid gap-2.5">
        {data.exercises.length === 0 ? (
          <p className="rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground">No exercise practised yet.</p>
        ) : data.exercises.map((e) => (
          <div key={e.exercise_id} className="rounded-2xl border border-border px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{e.title}</span>
              <span className="text-xs text-muted-foreground">
                {e.practices} {e.practices === 1 ? "practice" : "practices"}
                {e.too_few ? " · too few to read" : ""}
              </span>
            </div>
            <div className="mt-1.5">
              <div className={row}>
                <span className="text-muted-foreground">Sounded better right away</span>
                <span>{parts([[e.right_away.better, "yes"], [e.right_away.not_yet, "not yet"], [e.right_away.not_checked, "not checked"]])}</span>
              </div>
              <div className={row}>
                <span className="text-muted-foreground">Coach heard it get better</span>
                <span>{parts([[e.coach.agreed, "yes"], [e.coach.did_not, "no"], [e.coach.waiting, "waiting"]])}</span>
              </div>
              <div className={row}>
                <span className="text-muted-foreground">They said it sounded better</span>
                <span>{parts([[e.own_answer.yes, "yes"], [e.own_answer.no, "no"], [e.own_answer.none, "no answer"]])}</span>
              </div>
              <div className={row}>
                <span className="text-muted-foreground">Held in the next Take</span>
                <span>{parts([[e.next_take.held, "held"], [e.next_take.came_back, "came back"], [e.next_take.unknown, "unknown"], [e.next_take.waiting, "no next Take yet"]])}</span>
              </div>
              <div className={row}>
                <span className="text-muted-foreground">Tries</span>
                <span>{parts([[e.tries.none, "none"], [e.tries.one, "once"], [e.tries.two, "twice"], [e.tries.three, "three times"], [e.skipped, "skipped"]])}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Only you see this. Fewer than {data.too_few_below} practices of one exercise is too few to read.
      </p>
    </section>
  );
}
