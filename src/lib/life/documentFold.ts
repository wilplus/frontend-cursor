/* -------------------------------------------------------------------------- */
/*  documentFold — the uploaded strategy fills the rest of setup in            */
/*                                                                            */
/*  Founder 2026-07-30: "keep it so it works like a CV generator that fills    */
/*  the goals from the docs". So the document step is not a side entrance to a */
/*  review screen at the end. It is the FIRST real question, and answering it  */
/*  fills the eight horizon screens the user is about to walk through.         */
/*                                                                            */
/*  FOLD ONLY FORWARD. This is the rule that keeps the fill honest, and it is  */
/*  why bets are deliberately not folded even though the backend drafts them.  */
/*  The document step sits at index 1; every goals step is after it and the    */
/*  bets step is before it. A goal folded into "Weekly" appears on a screen    */
/*  the user has not reached yet, so they see it, edit it, or delete it before */
/*  it is ever saved as an answer. A bet folded into step 0 would be written   */
/*  onto a screen already behind them, landing text they never saw. That is    */
/*  exactly the failure N5 exists to prevent, so bet rows stay in the          */
/*  remainder and are reviewed as checkable lines on the last screen instead.  */
/*                                                                            */
/*  NOTHING IS EVER DROPPED. Every row the backend returns either folds into a */
/*  horizon or comes back in `remainder` for the last-screen review. A row     */
/*  with a horizon this frontend does not know is remainder, not a silent      */
/*  discard: an unrecognised horizon is a contract drift, and losing the       */
/*  user's goal is a worse answer to that than showing it somewhere plain.     */
/*                                                                            */
/*  The user's own typing always wins. Folded goals are APPENDED beneath what  */
/*  is already there, never written over it, and a drafted row that repeats a  */
/*  goal already on the screen is skipped rather than duplicated.              */
/* -------------------------------------------------------------------------- */

import type { LifeDraftItem } from "@/services/api/life";
import {
  LIFE_SETUP_STEPS,
  type LifeSetupAnswers,
  type LifeSetupGoal,
} from "./setupSteps";

/** The horizon keys a goal row is allowed to fold into: the goals steps, which
 *  are all after the document step. These are STRATEGY horizons — daily,
 *  weekly, monthly, quarterly, yearly, five_year, ten_year, twenty_year. */
const GOAL_HORIZONS: ReadonlySet<string> = new Set(
  LIFE_SETUP_STEPS.filter((s) => s.kind === "goals").map((s) => s.key)
);

/** WHICH SCREEN a drafted row belongs on.
 *
 *  This used to read `item.horizon`, and that was the bug: `horizon` is the
 *  ITEM vocabulary (now / week / month / quarter / year / five_year /
 *  ten_year / twenty_year) while the step keys above are the STRATEGY
 *  vocabulary (daily / weekly / monthly / quarterly / yearly / ...). The two
 *  overlap on exactly three values — five_year, ten_year, twenty_year — so a
 *  document filled those three screens and left Daily, Weekly, Monthly,
 *  Quarterly and This year empty, with every one of those goals pushed into
 *  the remainder. The backend sends `strategy_horizon` precisely so this side
 *  does not have to translate.
 *
 *  The `?? horizon` fallback is for a backend that predates the field: it
 *  keeps the old long-end fold rather than folding nothing at all, so this
 *  change is safe to ship before the backend that feeds it. */
function screenFor(item: LifeDraftItem): string | null {
  return item.strategyHorizon ?? item.horizon;
}

export interface DocumentFoldResult {
  /** The answers with the drafted goals filled in. A NEW object; the input is
   *  never mutated, because it is React state. */
  answers: LifeSetupAnswers;
  /** How many goals were actually written into a horizon. Duplicates skipped
   *  and rows sent to the remainder are not counted here, so this number is
   *  what the user will actually find on the next screens. */
  filledGoals: number;
  /** Everything that did not fold: bets, habits, distractions, and any goal
   *  whose horizon this frontend does not recognise. Reviewed as checkable
   *  rows on the last screen and created on Finish. */
  remainder: LifeDraftItem[];
}

function normalise(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function foldDraftIntoAnswers(
  items: LifeDraftItem[],
  answers: LifeSetupAnswers
): DocumentFoldResult {
  const horizons: Record<string, LifeSetupGoal[]> = {};
  for (const [key, list] of Object.entries(answers.horizons)) {
    horizons[key] = [...list];
  }

  // Seeded from what is ALREADY on each screen, so a drafted row that repeats
  // a goal the user typed is skipped rather than added twice.
  const seen = new Map<string, Set<string>>();
  for (const [key, list] of Object.entries(horizons)) {
    seen.set(key, new Set(list.map((g) => normalise(g.title)).filter(Boolean)));
  }

  const remainder: LifeDraftItem[] = [];
  let filledGoals = 0;
  let seq = 0;

  for (const item of items) {
    const horizon = screenFor(item);
    const title = item.title.trim();

    if (item.kind !== "goal" || !horizon || !GOAL_HORIZONS.has(horizon)) {
      remainder.push(item);
      continue;
    }
    // A goal row with no title is not an answer, and there is no screen where
    // an empty row means anything.
    if (title === "") continue;

    const key = normalise(title);
    let taken = seen.get(horizon);
    if (!taken) {
      taken = new Set<string>();
      seen.set(horizon, taken);
    }
    if (taken.has(key)) continue;
    taken.add(key);

    seq += 1;
    const goal: LifeSetupGoal = {
      id: `${horizon}-doc-${seq}`,
      title,
      // The due label is the user's notation and is stored verbatim, so a
      // drafted one is carried across exactly as it came and left editable.
      dueLabel: item.dueLabel ?? "",
      quantity: "",
      // The body is what the document said about this goal. It belongs in the
      // field that asks how you will know it happened rather than being
      // thrown away, and the user can overwrite it on the screen.
      measure: item.body.trim(),
      betKey:
        item.bet === "life" || item.bet === "company" || item.bet === "dream"
          ? item.bet
          : null,
    };
    horizons[horizon] = [...(horizons[horizon] ?? []), goal];
    filledGoals += 1;
  }

  return {
    answers: { bets: answers.bets, horizons },
    filledGoals,
    remainder,
  };
}
