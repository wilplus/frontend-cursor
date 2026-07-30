/* -------------------------------------------------------------------------- */
/*  life/setupSteps — the shape of the setup form (FE-3)                       */
/*                                                                            */
/*  Eight horizons plus the bets step. The horizon keys are the wire keys the  */
/*  backend stores and the resume step is named with, so they are here rather  */
/*  than inline in the component: `resume_step` from `/v2/life/state` has to   */
/*  resolve against exactly this list.                                        */
/*                                                                            */
/*  Ordering is deliberate: the bets come FIRST. Every goal hangs off a bet    */
/*  (spec §3.2), so asking for goals before the bets exist produces goals with */
/*  nothing to hang from.                                                     */
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
    // after the bets: someone who already wrote their strategy should not
    // type eight horizons before discovering they could have handed it over.
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
  /** Anything the document said about this goal beyond its one-line title.
   *  Empty for every goal the user typed here, and empty for almost every
   *  drafted one. It exists so that a document that DID say more does not
   *  have that sentence dropped on the floor between the extractor and the
   *  form: the row is rendered with it, or it is gone and nobody knows. */
  note: string;
  /** N5 — provenance, and whether the user has looked at it yet.
   *
   *  `source: "document"` + `confirmed: false` is the state that must LOOK
   *  different from a row the user typed. It stops being unconfirmed the
   *  moment they edit it, keep it, or file it from the unplaced list; the
   *  provenance stays either way, because "you did not write this" remains
   *  true after they have approved it. */
  source: "user" | "document";
  confirmed: boolean;
}

/** A row as the prefill endpoint hands it over, before it becomes a form row.
 *  `section` is the wizard step the backend filed it under, or null for the
 *  unplaced. */
export interface LifePrefillRow {
  title: string;
  body: string;
  dueLabel: string | null;
  betKey: "life" | "company" | "dream" | null;
  section: string | null;
}

export interface LifeSetupBet {
  key: "life" | "company" | "dream";
  rank: number;
  meaning: string;
}

export interface LifeSetupAnswers {
  bets: LifeSetupBet[];
  horizons: Record<string, LifeSetupGoal[]>;
  /** Goals the document wrote but filed under no horizon. THESE ARE NOT
   *  DECORATION: they are things the user actually wrote down, and the one
   *  failure this feature cannot afford is dropping them quietly. They live
   *  in the answers rather than in component state precisely so that an
   *  interruption does not lose them: every step's PUT carries the whole
   *  answers object, so they are saved and resumed exactly like a goal. */
  unplaced: LifeSetupGoal[];
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
    horizons[step.key] = coerceGoalList(rawHorizons[step.key], step.key);
  }

  return {
    bets: bets.length === 3 ? bets.sort((a, b) => a.rank - b.rank) : DEFAULT_BETS,
    horizons,
    unplaced: coerceGoalList(r.unplaced, "unplaced"),
  };
}

function coerceGoalList(list: unknown, keyPrefix: string): LifeSetupGoal[] {
  if (!Array.isArray(list)) return [];
  return (list as unknown[]).flatMap((row, i) => {
    if (!row || typeof row !== "object") return [];
    const g = row as Record<string, unknown>;
    const betKey = g.betKey ?? g.bet_key;
    return [
      {
        id: typeof g.id === "string" ? g.id : `${keyPrefix}-${i}`,
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
        note: typeof g.note === "string" ? g.note : "",
        // A row saved before prefill existed is one the user typed, so it
        // defaults to theirs and already approved. Reading these faithfully
        // is what keeps the "not yours yet" mark alive across a resume: a
        // drafted row the user never looked at must still be marked when
        // they come back to it two days later.
        source: g.source === "document" ? "document" : "user",
        confirmed: g.source === "document" ? g.confirmed === true : true,
      },
    ];
  });
}

/** Row ids only have to be unique within one sitting, and stable across
 *  renders so React does not remount an input somebody is typing into. A
 *  counter is enough; these are never identity anywhere but here. */
let goalIdSeq = 0;
export function nextGoalId(stepKey: string): string {
  goalIdSeq += 1;
  return `${stepKey}-${goalIdSeq}`;
}

/** A goal with no title is a blank row the user left behind, not an answer. */
export function pruneAnswers(answers: LifeSetupAnswers): LifeSetupAnswers {
  const horizons: Record<string, LifeSetupGoal[]> = {};
  for (const [key, list] of Object.entries(answers.horizons)) {
    horizons[key] = list.filter((g) => g.title.trim() !== "");
  }
  return {
    bets: answers.bets,
    horizons,
    unplaced: answers.unplaced.filter((g) => g.title.trim() !== ""),
  };
}

/* -------------------------------------------------------------------------- */
/*  Prefill from the uploaded document (founder 2026-07-30)                    */
/*                                                                            */
/*  "like a CV you upload and all the forms are filled." The backend reads the */
/*  document once and hands back the goals already bucketed into the wizard's  */
/*  own steps, so the Weekly step opens with the weekly goals IN it rather     */
/*  than empty beside a flat list the user has to re-sort by hand.            */
/*                                                                            */
/*  Two rules shape everything below:                                          */
/*                                                                            */
/*  N5 — NOTHING APPEARS ALREADY ACCEPTED. A merged row lands as               */
/*  `source: "document"`, `confirmed: false`, and the form renders that state  */
/*  differently from a row the user typed. Merging is not approving; the       */
/*  goals become real items only through /setup/complete, at the end, after    */
/*  the user has walked every step they now sit on.                            */
/*                                                                            */
/*  NOTHING IS DROPPED. A goal the document filed under no horizon goes to     */
/*  `unplaced`, and so does a goal filed under a section this build has no     */
/*  step for. The second case is the one worth stating out loud: if the        */
/*  backend adds a ninth horizon before the FE does, those rows must surface   */
/*  somewhere the user can see them, not vanish into a key nothing renders.    */
/* -------------------------------------------------------------------------- */

/** Titles compare on trimmed lowercase. Re-running the prefill then converges
 *  instead of accumulating, which is the same promise the backend's own merge
 *  makes on its side. */
function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

function toGoal(row: LifePrefillRow, idPrefix: string): LifeSetupGoal {
  return {
    id: nextGoalId(idPrefix),
    title: row.title.trim(),
    dueLabel: row.dueLabel ?? "",
    // The document has no equivalent of either field, and guessing one would
    // put words in the user's mouth on a screen whose whole point is that it
    // holds what they actually wrote.
    quantity: "",
    measure: "",
    betKey: row.betKey,
    note: row.body.trim(),
    source: "document",
    confirmed: false,
  };
}

export interface LifePrefillPayload {
  /** Always all eight wizard keys, in wizard order. */
  sections: Record<string, LifePrefillRow[]>;
  unplaced: LifePrefillRow[];
}

/**
 * Fold a prefill payload into the answers the form is holding.
 *
 * NON-DESTRUCTIVE, deliberately and in the same way the backend's merge is:
 * a step the user already answered keeps what they typed, and drafted rows are
 * APPENDED after it, never in place of it. A drafted title that is already in
 * the step is not added twice.
 *
 * `sectionKeys` is the server's `setup_sections`, so the step to key mapping
 * comes from one place rather than from a second list on the client that
 * drifts. Anything outside it still gets read, and still lands in `unplaced`.
 */
export function mergePrefill(
  answers: LifeSetupAnswers,
  prefill: LifePrefillPayload,
  sectionKeys: readonly string[]
): { answers: LifeSetupAnswers; added: number } {
  const goalStepKeys = new Set(
    LIFE_SETUP_STEPS.filter((s) => s.kind === "goals").map((s) => s.key)
  );
  const horizons: Record<string, LifeSetupGoal[]> = { ...answers.horizons };
  let added = 0;

  // Server order first, then any section the server did not list. The second
  // half only matters if the two lists disagree, and when they do the rows
  // still have to go somewhere.
  const ordered = [
    ...sectionKeys.filter((k) => k in prefill.sections),
    ...Object.keys(prefill.sections).filter((k) => !sectionKeys.includes(k)),
  ];

  const overflow: LifePrefillRow[] = [];
  for (const key of ordered) {
    const rows = prefill.sections[key] ?? [];
    if (!goalStepKeys.has(key)) {
      // A section with no step in this build. Not droppable: park it with the
      // unplaced, where the user can file it by hand.
      overflow.push(...rows);
      continue;
    }
    const existing = horizons[key] ?? [];
    const seen = new Set(existing.map((g) => titleKey(g.title)));
    const fresh: LifeSetupGoal[] = [];
    for (const row of rows) {
      const key2 = titleKey(row.title);
      if (!key2 || seen.has(key2)) continue;
      seen.add(key2);
      fresh.push(toGoal(row, key));
    }
    added += fresh.length;
    horizons[key] = [...existing, ...fresh];
  }

  // Unplaced dedupes against everything already placed as well as against
  // itself. Without the first half, a row the user has already filed into a
  // step comes back as unplaced on the next run and asks to be filed again.
  const placed = new Set(
    Object.values(horizons).flatMap((list) => list.map((g) => titleKey(g.title)))
  );
  const unplaced = [...answers.unplaced];
  const seenUnplaced = new Set(unplaced.map((g) => titleKey(g.title)));
  for (const row of [...prefill.unplaced, ...overflow]) {
    const key = titleKey(row.title);
    if (!key || placed.has(key) || seenUnplaced.has(key)) continue;
    seenUnplaced.add(key);
    unplaced.push(toGoal(row, "unplaced"));
    added += 1;
  }

  return { answers: { ...answers, horizons, unplaced }, added };
}

/** File one unplaced goal into a step. Choosing where it belongs is an act of
 *  keeping, so it stops being unconfirmed; the provenance stays, because "the
 *  document wrote this, not you" is still true afterwards. */
export function placeUnplacedGoal(
  answers: LifeSetupAnswers,
  id: string,
  sectionKey: string
): LifeSetupAnswers {
  const goal = answers.unplaced.find((g) => g.id === id);
  if (!goal || !(sectionKey in answers.horizons)) return answers;
  return {
    ...answers,
    unplaced: answers.unplaced.filter((g) => g.id !== id),
    horizons: {
      ...answers.horizons,
      [sectionKey]: [
        ...(answers.horizons[sectionKey] ?? []),
        { ...goal, confirmed: true },
      ],
    },
  };
}
