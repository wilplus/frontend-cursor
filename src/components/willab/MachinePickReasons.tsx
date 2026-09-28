"use client";

/* -------------------------------------------------------------------------- */
/*  What the machine picked for this moment, and why (backend 2026-09-28,     */
/*  steps 6–7).                                                               */
/*                                                                            */
/*  COACH ONLY, AFTER THE BLIND RATING. Both hosts (the practice review and   */
/*  the exercise-request panel) fetch only once the coach's own Yes/No is     */
/*  saved, and the backend sends these fields only behind the same gate.      */
/*                                                                            */
/*  The coach sees a trial openly: this is their view, not the speaker's.     */
/*  Never shown: the machine's confidence read of the clip, the raw           */
/*  measurements, or a rank as a number. Ranked exercises are listed in       */
/*  their order instead.                                                      */
/*                                                                            */
/*  Every sentence lives in MACHINE_PICK_COPY. Founder sign-off 2026-09-28.    */
/*  In its own file because CoachConfidencePracticeReview is grandfathered    */
/*  at the complexity ratchet and may only shrink.                            */
/* -------------------------------------------------------------------------- */

import type {
  CandidateReason,
  MachinePick,
  MatchCandidate,
} from "@/services/api/machinePick";

export const MACHINE_PICK_COPY = {
  heading: "What the machine picked",
  picked: (title: string) => `Machine picked “${title}”`,
  fit: { exact: "exact fit", trial: "trial: it treats this as a secondary problem" },
  how: {
    best_match: "best match",
    trying_another: "trying another: picked on purpose to learn whether it helps",
    only_match: "the only match",
  },
  because: (labels: string) => `because it spotted ${labels}`,
  untraced: "The reasons for this pick weren’t recorded. It was made before reasons were saved.",
  repeated: (labels: string) => `${labels} came up on earlier Takes too.`,
  others: "Other exercises and why they weren’t picked",
  whyNothing: "Why nothing fitted",
  noneWeighed: "No exercise in the library was weighed for this moment.",
  doneBefore: "done before",
  keepsComingBack: "treats a problem that keeps coming back",
  rankedBelow: "Ranked below the pick.",
  ranked: "Ranked, but not picked.",
  reason: {
    nothing_spotted: "Nothing was spotted on this clip.",
    targets_nothing_that_fired: "Treats nothing that was spotted here.",
    confidence_level_unplaceable: "Couldn’t be placed on this moment.",
    lower_fit_than_pool: "A closer fit was available.",
  } satisfies Record<CandidateReason, string>,
  notPicked: "Not picked.",
} as const;

type Titles = ReadonlyMap<string, string>;

function titleOf(titles: Titles, id: string): string {
  return titles.get(id) ?? id;
}

function labelsOf(ids: readonly string[], spotted: MachinePick["spotted"]): string {
  const known = new Map(spotted.map((s) => [s.errorId, s.label]));
  return ids.map((id) => known.get(id) ?? id).join(", ");
}

/** The one-line summary of the pick. */
export function pickSentence(pick: MachinePick, titles: Titles): string {
  const parts = [pick.fit ? MACHINE_PICK_COPY.fit[pick.fit] : null, MACHINE_PICK_COPY.how[pick.howChosen]]
    .filter(Boolean)
    .join(", ");
  const because = pick.spotted.length
    ? ` ${MACHINE_PICK_COPY.because(pick.spotted.map((s) => s.label).join(", "))}`
    : "";
  return `${MACHINE_PICK_COPY.picked(titleOf(titles, pick.exerciseId))} (${parts})${because}.`;
}

/** Why one candidate was not the pick. */
export function candidateReason(candidate: MatchCandidate, picked: boolean): string {
  if (candidate.outcome === "excluded") {
    return candidate.reason ? MACHINE_PICK_COPY.reason[candidate.reason] : MACHINE_PICK_COPY.notPicked;
  }
  return picked ? MACHINE_PICK_COPY.rankedBelow : MACHINE_PICK_COPY.ranked;
}

function CandidateList({
  candidates,
  skip,
  titles,
  picked,
}: {
  candidates: MatchCandidate[];
  skip: string | null;
  titles: Titles;
  picked: boolean;
}) {
  const rows = candidates.filter((c) => c.exerciseId !== skip);
  if (rows.length === 0) {
    return <p className="text-[12.5px] text-muted-foreground">{MACHINE_PICK_COPY.noneWeighed}</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((c) => (
        <li key={c.exerciseId} className="rounded-lg border border-border bg-background px-3 py-2 text-[12.5px]">
          <span className="font-medium text-foreground">{titleOf(titles, c.exerciseId)}</span>
          {c.fit ? <span className="text-muted-foreground"> · {MACHINE_PICK_COPY.fit[c.fit]}</span> : null}
          {c.doneBefore ? <span className="text-success"> · {MACHINE_PICK_COPY.doneBefore}</span> : null}
          {c.repeatHits > 0 ? <span className="text-muted-foreground"> · {MACHINE_PICK_COPY.keepsComingBack}</span> : null}
          <span className="block text-muted-foreground">{candidateReason(c, picked)}</span>
        </li>
      ))}
    </ul>
  );
}

/** On the practice review: the pick, its reasons, and the speaker's history. */
export function MachinePickReasons({ pick, titles }: { pick: MachinePick | null; titles: Titles }) {
  if (!pick) return null;
  return (
    <section data-testid="machine-pick" className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{MACHINE_PICK_COPY.heading}</p>
      <p className="text-[13.5px] leading-relaxed text-foreground">{pickSentence(pick, titles)}</p>
      {pick.history?.repeatedPatterns.length ? (
        <p className="text-[12.5px] text-muted-foreground">
          {MACHINE_PICK_COPY.repeated(labelsOf(pick.history.repeatedPatterns, pick.spotted))}
        </p>
      ) : null}
      {pick.traced ? (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer font-medium text-foreground">{MACHINE_PICK_COPY.others}</summary>
          <div className="mt-2">
            <CandidateList candidates={pick.candidates} skip={pick.exerciseId} titles={titles} picked />
          </div>
        </details>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">{MACHINE_PICK_COPY.untraced}</p>
      )}
    </section>
  );
}

/** On a coach request: every exercise weighed, and why none fitted. */
export function WhyNothingFitted({ candidates, titles }: { candidates: MatchCandidate[]; titles: Titles }) {
  // An older backend sends no candidates: say nothing rather than "none weighed".
  if (candidates.length === 0) return null;
  return (
    <details data-testid="why-nothing-fitted" className="text-[12.5px]">
      <summary className="cursor-pointer font-medium text-foreground">{MACHINE_PICK_COPY.whyNothing}</summary>
      <div className="mt-2">
        <CandidateList candidates={candidates} skip={null} titles={titles} picked={false} />
      </div>
    </details>
  );
}

/** Exercise titles the host already has, by id. */
export function titlesFrom(
  ...lists: ReadonlyArray<ReadonlyArray<{ exerciseId: string; title: string }>>
): Map<string, string> {
  return new Map(lists.flat().map((e) => [e.exerciseId, e.title]));
}
