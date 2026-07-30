/* -------------------------------------------------------------------------- */
/*  life/setupSteps — the shape of the setup form (FE-3)                       */
/*                                                                            */
/*  Eight horizons, the bets step, and the document step. The horizon keys are */
/*  the wire keys the backend stores and the resume step is named with, so     */
/*  they are here rather than inline in the component: `resume_step` from      */
/*  `/v2/life/state` has to resolve against exactly this list.                 */
/*                                                                            */
/*  Ordering is deliberate, and both of the first two steps are load-bearing   */
/*  where they are:                                                           */
/*                                                                            */
/*    · The BETS come first. Every goal hangs off a bet (spec §3.2), so asking */
/*      for goals before the bets exist produces goals with nothing to hang    */
/*      from.                                                                 */
/*    · The DOCUMENT comes second, before every horizon. It is not a side      */
/*      question: uploading fills the eight horizon screens in from what the   */
/*      document says (see documentFold), so it has to be answered while       */
/*      those screens are still ahead of the user. Asked any later it would    */
/*      be offering to fill in answers they had already typed by hand.        */
/*                                                                            */
/*  INSERTING A STEP IS NOT FREE, and this list is why. Setup resumes at the   */
/*  saved `resume_step`, so anyone partway through when the document step was  */
/*  added on 2026-07-30 resumed at a later horizon and jumped clean over it.   */
/*  That is what put the same upload on /panel/goals: a step added mid-flight  */
/*  needs a door that does not depend on walking past it.                     */
/* -------------------------------------------------------------------------- */

export interface LifeSetupStep {
  key: string;
  title: string;
  /** One line under the title. Plain, no exhortation. */
  hint: string;
  /** The bets step is its own editor, the document step is the optional
   *  strategy upload (founder 2026-07-30), the rest are goal lists. */
  kind: "bets" | "document" | "goals";
  /** Suggested due-label form for this horizon, shown as a placeholder. The
   *  user's own notation always wins: the label is stored verbatim. */
  duePlaceholder?: string;
}

export const LIFE_SETUP_STEPS: readonly LifeSetupStep[] = [
  {
    key: "bets",
    kind: "bets",
    title: "Your three bets",
    hint: "In order. The order decides what wins when two of them want the same morning.",
  },
  {
    // Founder 2026-07-30 — the optional strategy upload sits EARLY, right
    // after the bets, and it is what fills the eight horizons in. Someone who
    // already wrote their strategy should not type eight screens before
    // discovering they could have handed it over.
    // Skippable by design: Next with nothing uploaded is a complete answer.
    key: "document",
    kind: "document",
    title: "Current strategy (optional)",
    hint: "",
  },
  {
    key: "daily",
    kind: "goals",
    title: "Daily",
    hint: "What has to happen on an ordinary day.",
    duePlaceholder: "[NOW]",
  },
  {
    key: "weekly",
    kind: "goals",
    title: "Weekly",
    hint: "What a week has to produce.",
    duePlaceholder: "[this week]",
  },
  {
    key: "monthly",
    kind: "goals",
    title: "Monthly",
    hint: "What the month is for.",
    duePlaceholder: "[Aug]",
  },
  {
    key: "quarterly",
    kind: "goals",
    title: "Quarterly",
    hint: "The next ninety days.",
    duePlaceholder: "[Q4]",
  },
  {
    key: "yearly",
    kind: "goals",
    title: "This year",
    hint: "What has to be true by the end of it.",
    duePlaceholder: "[Dec]",
  },
  {
    key: "five_year",
    kind: "goals",
    title: "Five years",
    hint: "Far enough out that the shape matters more than the date.",
    duePlaceholder: "[Jul '31]",
  },
  {
    key: "ten_year",
    kind: "goals",
    title: "Ten years",
    hint: "",
    duePlaceholder: "2036",
  },
  {
    key: "twenty_year",
    kind: "goals",
    title: "Twenty years",
    hint: "The one you will be judged against by yourself.",
    duePlaceholder: "2046",
  },
];

export function stepIndex(key: string | null): number {
  if (!key) return 0;
  const i = LIFE_SETUP_STEPS.findIndex((s) => s.key === key);
  return i < 0 ? 0 : i;
}

/** One goal as the form holds it. `dueLabel` is free text on purpose: the
 *  label is the source of truth, and a date picker would quietly normalise
 *  "[Jul '27]" into something the user did not write (spec §3.2). */
export interface LifeSetupGoal {
  id: string;
  title: string;
  dueLabel: string;
  quantity: string;
  measure: string;
  betKey: "life" | "company" | "dream" | null;
}

export interface LifeSetupBet {
  key: "life" | "company" | "dream";
  rank: number;
  meaning: string;
}

export interface LifeSetupAnswers {
  bets: LifeSetupBet[];
  horizons: Record<string, LifeSetupGoal[]>;
}

const DEFAULT_BETS: LifeSetupBet[] = [
  { key: "life", rank: 1, meaning: "" },
  { key: "company", rank: 2, meaning: "" },
  { key: "dream", rank: 3, meaning: "" },
];

/** Read a saved draft back into form state, tolerating anything missing. */
export function coerceSetupAnswers(raw: unknown): LifeSetupAnswers {
  const r =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const bets: LifeSetupBet[] = Array.isArray(r.bets)
    ? (r.bets as unknown[]).flatMap((row, i) => {
        if (!row || typeof row !== "object") return [];
        const b = row as Record<string, unknown>;
        const key = b.key;
        if (key !== "life" && key !== "company" && key !== "dream") return [];
        return [
          {
            key,
            rank: typeof b.rank === "number" ? b.rank : i + 1,
            meaning: typeof b.meaning === "string" ? b.meaning : "",
          },
        ];
      })
    : [];

  const horizons: Record<string, LifeSetupGoal[]> = {};
  const rawHorizons =
    r.horizons && typeof r.horizons === "object"
      ? (r.horizons as Record<string, unknown>)
      : {};
  for (const step of LIFE_SETUP_STEPS) {
    if (step.kind !== "goals") continue;
    const list = rawHorizons[step.key];
    horizons[step.key] = Array.isArray(list)
      ? (list as unknown[]).flatMap((row, i) => {
          if (!row || typeof row !== "object") return [];
          const g = row as Record<string, unknown>;
          const betKey = g.betKey ?? g.bet_key;
          return [
            {
              id: typeof g.id === "string" ? g.id : `${step.key}-${i}`,
              title: typeof g.title === "string" ? g.title : "",
              dueLabel:
                typeof g.dueLabel === "string"
                  ? g.dueLabel
                  : typeof g.due_label === "string"
                    ? g.due_label
                    : "",
              quantity: typeof g.quantity === "string" ? g.quantity : "",
              measure: typeof g.measure === "string" ? g.measure : "",
              betKey:
                betKey === "life" || betKey === "company" || betKey === "dream"
                  ? betKey
                  : null,
            },
          ];
        })
      : [];
  }

  return {
    bets: bets.length === 3 ? bets.sort((a, b) => a.rank - b.rank) : DEFAULT_BETS,
    horizons,
  };
}

/** A goal with no title is a blank row the user left behind, not an answer. */
export function pruneAnswers(answers: LifeSetupAnswers): LifeSetupAnswers {
  const horizons: Record<string, LifeSetupGoal[]> = {};
  for (const [key, list] of Object.entries(answers.horizons)) {
    horizons[key] = list.filter((g) => g.title.trim() !== "");
  }
  return { bets: answers.bets, horizons };
}
