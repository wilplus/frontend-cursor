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
                          {bet.rank}. {bet.label || meta?.label}
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
    </>
  );
}
