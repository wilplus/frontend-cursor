"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EMPTY, VIEWS } from "@/lib/life/copy";
import { principlesTabView } from "@/lib/life/types";
import { fetchPrinciples } from "@/services/api/life";
import { useLifePanel } from "@/components/life/PanelShell";
import FirstRun from "@/components/life/FirstRun";
import SetupFlow from "@/components/life/SetupFlow";
import StrategyPanel from "@/components/life/StrategyPanel";
import ProposalDeck from "@/components/life/ProposalCards";
import {
  EmptyState,
  Eyebrow,
  PanelLede,
  Resource,
  usePanelResource,
} from "@/components/life/primitives";

/* -------------------------------------------------------------------------- */
/*  FE-4 — the Principles tab, state-dependent                                 */
/*                                                                            */
/*  Three jobs, never on one page:                                            */
/*    no consent          → the guide, then the consent screen                 */
/*    consented, no setup → resume setup                                       */
/*    setup complete      → results                                            */
/*                                                                            */
/*  Results order is fixed by the spec: the derived principles on top, the     */
/*  strategy document below. Principles first because they are the thing the   */
/*  user earned; the document is generated.                                    */
/* -------------------------------------------------------------------------- */

export default function PrinciplesPage() {
  const { state, refresh } = useLifePanel();
  const router = useRouter();
  const view = principlesTabView(state);

  if (view === "first_run") {
    return (
      <FirstRun
        requiredVersion={state.consent.requiredVersion}
        onConsented={() => void refresh()}
      />
    );
  }

  if (view === "setup") {
    return (
      <SetupFlow
        resumeStep={state.setup.resumeStep}
        onComplete={() => {
          void refresh();
          router.refresh();
        }}
      />
    );
  }

  return <PrinciplesResults />;
}

function PrinciplesResults() {
  const load = useCallback(() => fetchPrinciples(), []);
  const resource = usePanelResource(load, "principles");

  return (
    <>
      <PanelLede lede={VIEWS.principles.lede} />

      {/* Pull, never push (L-4): the conflict and retire questions wait here
          until the panel is opened. Nothing notified anyone. */}
      <ProposalDeck kinds={["conflict", "retire"]} title="Waiting for you" />

      <Resource resource={resource}>
        {(principles) =>
          principles.length === 0 ? (
            <EmptyState>{EMPTY.principles}</EmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {principles.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/panel/principles/${p.id}`}
                    className="block px-4 py-3.5 hover:bg-muted/50"
                  >
                    <p className="text-[15px] font-medium text-foreground">
                      {p.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {/* L-5 — a count of citations and nothing more. Not a
                          rank, not a weight, not a score (N4). */}
                      {p.applicationCount === 0
                        ? EMPTY.applications
                        : `Cited ${p.applicationCount} ${
                            p.applicationCount === 1 ? "time" : "times"
                          }`}
                      {p.retired ? " · retired" : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </Resource>

      <div className="mt-10">
        <Eyebrow>Your strategy</Eyebrow>
        <div className="mt-3">
          <StrategyPanel compact />
        </div>
      </div>
    </>
  );
}
