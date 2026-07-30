"use client";

import { useCallback } from "react";
import { EMPTY, VIEWS } from "@/lib/life/copy";
import { betByKey } from "@/lib/life/types";
import { fetchGoals } from "@/services/api/life";
import {
  EmptyState,
  PanelHeading,
  Resource,
  usePanelResource,
} from "@/components/life/primitives";
import StrategyDocumentPanel from "@/components/life/StrategyDocument";

/* -------------------------------------------------------------------------- */
/*  FE-9 — Goals. Bets in rank order, goals beneath.                           */
/*                                                                            */
/*  Two things here are data, not styling:                                     */
/*    · The ORDER of the bets. Rank 1, 2, 3 render in that order and the       */
/*      number is shown, because the rank is what decides which bet wins a     */
/*      contested morning (spec §3.2).                                        */
/*    · The DUE LABEL, rendered verbatim: "[NOW]", "[Aug]", "[Jul '27]",       */
/*      "2035". The label is the source of truth, not the parsed date, so it   */
/*      is never reformatted into a tidier form the user did not write.        */
/*                                                                            */
/*  THE STRATEGY UPLOAD LIVES AT THE FOOT OF THIS VIEW (founder 2026-07-30).   */
/*  It is the same upload setup opens with, kept open afterwards, because      */
/*  setup runs once and a strategy does not. Here rather than on the Strategy  */
/*  view on purpose: that screen already has an Upload button meaning          */
/*  something else entirely (a revised copy of the GENERATED document, parsed  */
/*  into a diff to approve). Two Uploads side by side doing different things   */
/*  to the same word is how a user loses a document. And this is where they    */
/*  will look for it: the founder's own question was where to add the file the */
/*  goals get set from, and Goals is the first place that reads as.            */
/* -------------------------------------------------------------------------- */

export default function GoalsPage() {
  const load = useCallback(() => fetchGoals(), []);
  const resource = usePanelResource(load);

  return (
    <>
      <PanelHeading title={VIEWS.goals.title} lede={VIEWS.goals.lede} />
      <Resource resource={resource}>
        {(bets) =>
          bets.length === 0 ? (
            <EmptyState>{EMPTY.goals}</EmptyState>
          ) : (
            <ol className="space-y-8">
              {[...bets]
                .sort((a, b) => a.rank - b.rank)
                .map((bet) => {
                  const meta = betByKey(bet.key);
                  return (
                    <li key={bet.key}>
                      <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-tight text-foreground">
                        <span aria-hidden>{meta?.glyph}</span>
                        <span>
                          {/* LIFE_BETS wins over the served label for a key we
                              know. The backend echoes a label back on every day
                              plan and goal set it has ever written, so a rename
                              here (Company → Career, 2026-07-27) would other-
                              wise show the new word in setup and the old one on
                              this screen until every stored row was rewritten.
                              The served label still fills in for a key the
                              frontend does not know. */}
                          {bet.rank}. {meta?.label || bet.label}
                        </span>
                      </h2>
                      {bet.goals.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Nothing under this bet yet.
                        </p>
                      ) : (
                        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
                          {bet.goals.map((goal) => (
                            <li
                              key={goal.id}
                              className="flex items-start justify-between gap-4 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-[15px] text-foreground">
                                  {goal.title}
                                </p>
                                {goal.body ? (
                                  <p className="mt-0.5 text-sm text-muted-foreground">
                                    {goal.body}
                                  </p>
                                ) : null}
                              </div>
                              {goal.dueLabel ? (
                                <span className="shrink-0 whitespace-nowrap rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                                  {goal.dueLabel}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
            </ol>
          )
        }
      </Resource>
      {/* Rows created from a document are goals, habits, distractions and
          bets, so the list above is out of date the moment they land. */}
      <StrategyDocumentPanel onApplied={resource.reload} />
    </>
  );
}
