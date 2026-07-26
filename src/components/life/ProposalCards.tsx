"use client";

import { useCallback, useState } from "react";
import { CARDS, EMPTY } from "@/lib/life/copy";
import type {
  LifeConflictProposal,
  LifeProposal,
  LifeProposalKind,
  LifeRetireProposal,
  LifeStrategyProposal,
} from "@/lib/life/types";
import { decideProposal, fetchProposals, type LifeDecision } from "@/services/api/life";
import { EmptyState, Eyebrow, PanelCard, Resource, usePanelResource } from "./primitives";

/* -------------------------------------------------------------------------- */
/*  FE-7 — proposal, conflict and retire cards                                 */
/*                                                                            */
/*  N5, ONE SHARED DISCIPLINE: the model's output is visibly the model's until */
/*  the user accepts it. Every card carries a "Proposed" badge and a dashed    */
/*  border; the user's own text never does. Nothing renders as though it had   */
/*  already landed.                                                           */
/*                                                                            */
/*  Three rules are structural rather than cosmetic, so they are enforced by   */
/*  what this file can and cannot render:                                     */
/*                                                                            */
/*    L-2a — a strategy proposal against Section I (The Anchor) or the rank of */
/*      the bets has NO approve button. Not a disabled one, none: the markup   */
/*      branch that draws it does not run. The immutable core is hand-edited   */
/*      only, and a greyed button invites the question of how to ungrey it.    */
/*                                                                            */
/*    L-2 — every proposal displays one of the USER'S OWN principles as its    */
/*      warrant. The mapper drops a warrantless proposal before it reaches     */
/*      here, so there is no branch for rendering one bare.                    */
/*                                                                            */
/*    L-3 — a conflict card has no recommendation and no default selection.    */
/*      Both sides use IDENTICAL markup and classes. The system never picks,   */
/*      and the UI must not pick for it by making one side visually heavier,   */
/*      so the two halves are rendered by one component called twice.          */
/* -------------------------------------------------------------------------- */

export default function ProposalDeck({
  kinds,
  title,
}: {
  /** Which card types this surface shows. Omitted → all of them. */
  kinds?: LifeProposalKind[];
  title?: string;
}) {
  const load = useCallback(() => fetchProposals(), []);
  const { data, loaded, failed } = usePanelResource(load);

  // The deck is a supplement on someone else's page, so it renders nothing at
  // all while loading and nothing at all if the read fails. A "that did not
  // load" line above the day card would report a broken page that is not
  // broken. The dedicated ProposalList below is where a failure is worth
  // saying out loud.
  if (failed || !loaded || !data) return null;

  const list = kinds ? data.filter((p) => kinds.includes(p.kind)) : data;
  if (list.length === 0) return null;

  return (
    <section className="mb-8">
      {title ? <Eyebrow>{title}</Eyebrow> : null}
      <ul className="mt-3 space-y-4">
        {list.map((proposal) => (
          <li key={proposal.id}>
            <ProposalRow proposal={proposal} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Render proposals the caller already holds, e.g. the ranked batch of three
 *  that arrives inside the weekly review payload (L-2b). Same cards, same
 *  discipline, no second fetch. */
export function ProposalItems({ proposals }: { proposals: LifeProposal[] }) {
  if (proposals.length === 0) return null;
  return (
    <ul className="space-y-4">
      {proposals.map((proposal) => (
        <li key={proposal.id}>
          <ProposalRow proposal={proposal} />
        </li>
      ))}
    </ul>
  );
}

/** Standalone list for a dedicated surface, where "nothing waiting" is worth
 *  saying out loud rather than rendering as blank space. */
export function ProposalList() {
  const load = useCallback(() => fetchProposals(), []);
  const resource = usePanelResource(load);
  return (
    <Resource resource={resource}>
      {(list) =>
        list.length === 0 ? (
          <EmptyState>{EMPTY.proposals}</EmptyState>
        ) : (
          <ul className="space-y-4">
            {list.map((p) => (
              <li key={p.id}>
                <ProposalRow proposal={p} />
              </li>
            ))}
          </ul>
        )
      }
    </Resource>
  );
}

function ProposalRow({ proposal }: { proposal: LifeProposal }) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const decide = useCallback(
    async (decision: LifeDecision, note: string) => {
      if (pending) return;
      setPending(true);
      try {
        await decideProposal(proposal.id, decision);
        setResolved(note);
      } catch {
        setPending(false);
      }
    },
    [pending, proposal.id]
  );

  if (resolved) {
    return (
      <PanelCard>
        <p className="text-sm text-muted-foreground">{resolved}</p>
      </PanelCard>
    );
  }

  if (proposal.kind === "strategy") {
    return <StrategyCard proposal={proposal} pending={pending} decide={decide} />;
  }
  if (proposal.kind === "conflict") {
    return <ConflictCard proposal={proposal} pending={pending} decide={decide} />;
  }
  return <RetireCard proposal={proposal} pending={pending} decide={decide} />;
}

/* --------------------------- the proposed frame --------------------------- */

/** The dashed border and the badge are the whole point of N5: at a glance,
 *  this is not yours yet. */
function ProposedFrame({
  children,
  expiresAt,
}: {
  children: React.ReactNode;
  expiresAt?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-foreground/30 bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-foreground/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-foreground">
          {CARDS.proposedBadge}
        </span>
        {expiresAt ? (
          <span className="text-[11px] text-muted-foreground">
            {CARDS.expiresPrefix} {formatDay(expiresAt)}
          </span>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/* ------------------------------ strategy card ----------------------------- */

function StrategyCard({
  proposal,
  pending,
  decide,
}: {
  proposal: LifeStrategyProposal;
  pending: boolean;
  decide: (d: LifeDecision, note: string) => Promise<void>;
}) {
  return (
    <ProposedFrame expiresAt={proposal.expiresAt}>
      {proposal.section ? <Eyebrow>{proposal.section}</Eyebrow> : null}

      <div className="mt-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {CARDS.contradictsLabel}
        </p>
        <blockquote className="mt-1 border-l-2 border-border pl-3 text-sm italic text-foreground/80">
          {proposal.contradicts}
        </blockquote>
      </div>

      {proposal.diff.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-background">
          <pre className="min-w-full p-3 text-[13px] leading-[1.6]">
            {proposal.diff.map((line, i) => (
              <span
                key={i}
                className={
                  line.op === "add"
                    ? "block bg-emerald-50 text-emerald-900"
                    : line.op === "remove"
                      ? "block bg-rose-50 text-rose-900 line-through"
                      : "block text-foreground/70"
                }
              >
                {line.op === "add" ? "+ " : line.op === "remove" ? "- " : "  "}
                {line.text}
              </span>
            ))}
          </pre>
        </div>
      ) : null}

      {/* L-2 — the warrant is a principle the user wrote. Never a model
          rationale, never a confidence, never a number. */}
      <p className="mt-4 text-sm text-foreground">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {CARDS.warrantLabel}
        </span>
        <br />
        {proposal.warrant.title}
      </p>

      {proposal.reportOnly ? (
        // L-2a — no approve button exists here. This is the branch that draws
        // nothing actionable, on purpose.
        <p className="mt-4 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          {CARDS.reportOnly}
        </p>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void decide("approve", "Approved.")}
            className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background disabled:opacity-40"
          >
            {CARDS.approve}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void decide("dismiss", CARDS.dismissed)}
            className="rounded-full border border-border bg-background px-4 py-1.5 text-xs text-muted-foreground disabled:opacity-40"
          >
            {CARDS.dismiss}
          </button>
        </div>
      )}
    </ProposedFrame>
  );
}

/* ------------------------------ conflict card ----------------------------- */

function ConflictCard({
  proposal,
  pending,
  decide,
}: {
  proposal: LifeConflictProposal;
  pending: boolean;
  decide: (d: LifeDecision, note: string) => Promise<void>;
}) {
  return (
    <ProposedFrame expiresAt={proposal.expiresAt}>
      <p className="text-sm font-medium text-foreground">
        {CARDS.conflictTitle}
      </p>
      {proposal.occasion ? (
        <p className="mt-1 text-sm text-muted-foreground">{proposal.occasion}</p>
      ) : null}

      {/* Both halves render through ONE component, so neither can drift into
          looking like the recommended answer (L-3). */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ConflictSide principle={proposal.left} />
        <ConflictSide principle={proposal.right} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{CARDS.conflictHelp}</p>

      <div className="mt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => void decide("dismiss", "Noted. Both stay active.")}
          className="rounded-full border border-border bg-background px-4 py-1.5 text-xs text-muted-foreground disabled:opacity-40"
        >
          Noted
        </button>
      </div>
    </ProposedFrame>
  );
}

function ConflictSide({
  principle,
}: {
  principle: { id: string; title: string; body: string };
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-sm font-medium text-foreground">{principle.title}</p>
      {principle.body ? (
        <p className="mt-1 text-sm text-muted-foreground">{principle.body}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------- retire card ------------------------------ */

function RetireCard({
  proposal,
  pending,
  decide,
}: {
  proposal: LifeRetireProposal;
  pending: boolean;
  decide: (d: LifeDecision, note: string) => Promise<void>;
}) {
  const ordinal =
    proposal.existing.ordinal != null ? `#${proposal.existing.ordinal} ` : "";
  return (
    <ProposedFrame expiresAt={proposal.expiresAt}>
      <p className="text-sm text-foreground">{proposal.incoming.title}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {CARDS.retireQuestion}
      </p>
      <p className="mt-1 text-sm text-foreground">
        {ordinal}
        {proposal.existing.title}
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void decide("retire_yes", "Retired.")}
          className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background disabled:opacity-40"
        >
          {CARDS.retireYes}
        </button>
        {/* Veto. On No both stay active and the question is never asked again. */}
        <button
          type="button"
          disabled={pending}
          onClick={() => void decide("retire_no", CARDS.retireKept)}
          className="rounded-full border border-border bg-background px-4 py-1.5 text-xs text-foreground disabled:opacity-40"
        >
          {CARDS.retireNo}
        </button>
      </div>
    </ProposedFrame>
  );
}
