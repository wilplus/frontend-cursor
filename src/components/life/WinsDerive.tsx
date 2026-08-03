"use client";

import { useState } from "react";
import { CARDS, STATUS, WINS_DERIVE } from "@/lib/life/copy";
import {
  answerRetirePrompt,
  deriveFromWins,
  setItemStatus,
  type RetirePrompt,
  type WinsDerivation,
  type WinsProposal,
} from "@/services/api/life";
import type { LifeItem } from "@/lib/life/types";
import { PanelCard } from "./primitives";

/* -------------------------------------------------------------------------- */
/*  WinsDerive — "what do these wins teach?" (piece 6, founder-agreed          */
/*  2026-08-02)                                                               */
/*                                                                            */
/*  The case engine's positive mirror, and the same discipline end to end:    */
/*                                                                            */
/*    · FOUNDER-INITIATED, ALWAYS. This button is the only trigger. Nothing   */
/*      schedules it, no capture path fires it, #win still saves instantly    */
/*      with no model call (L-4: dormant until opened).                       */
/*    · PROPOSE, NEVER COMMIT (N5). Every card is a status "proposed" row.    */
/*      Approve and Dismiss are the explicit acts, one press per card, on a   */
/*      fully displayed line.                                                 */
/*    · GROUNDED OR DROPPED. Each card names the wins it was read out of,     */
/*      resolved against the wall already on screen. A lesson the model could */
/*      not point at a win never arrived at all (the backend enforces it;     */
/*      this component just shows the receipts).                              */
/*    · WINDOW HONESTY. A partial read says so in prose ("Read your last 20   */
/*      wins of 34."), and none of the counts ever renders as a meter         */
/*      (AC-9/N4).                                                            */
/*                                                                            */
/*  THE RETIRE QUESTION renders the BACKEND's words verbatim (BE-7 copy,      */
/*  already signed off). The veto is absolute, a "no" is remembered, and the  */
/*  approve itself retires nothing — the PATCH landed before the question is  */
/*  even shown, so dismissing the dialog loses nothing.                       */
/* -------------------------------------------------------------------------- */

export default function WinsDerive({ wins }: { wins: LifeItem[] }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [run, setRun] = useState<WinsDerivation | null>(null);
  const [cards, setCards] = useState<WinsProposal[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [decideFailed, setDecideFailed] = useState(false);
  /** The open retire question, tied to the principle whose approve raised it. */
  const [retire, setRetire] = useState<{
    principleId: string;
    prompt: RetirePrompt;
  } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function runDerive() {
    setBusy(true);
    setFailed(false);
    setNote(null);
    setRetire(null);
    try {
      const result = await deriveFromWins();
      setRun(result);
      setCards(result.proposed);
    } catch {
      setFailed(true);
      setRun(null);
      setCards([]);
    } finally {
      setBusy(false);
    }
  }

  async function decide(card: WinsProposal, status: "active" | "dismissed") {
    setDeciding(card.id);
    setDecideFailed(false);
    setNote(null);
    try {
      const { retirePrompt } = await setItemStatus(card.id, status);
      // The decision landed, so the card goes. On a failure it stays, with
      // its buttons live: the honest state is "still waiting for you".
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      if (status === "dismissed") setNote(CARDS.dismissed);
      if (retirePrompt) setRetire({ principleId: card.id, prompt: retirePrompt });
    } catch {
      setDecideFailed(true);
    } finally {
      setDeciding(null);
    }
  }

  async function answerRetire(decision: "yes" | "no") {
    if (!retire) return;
    setDeciding(retire.principleId);
    setDecideFailed(false);
    try {
      await answerRetirePrompt(
        retire.principleId,
        retire.prompt.retiresId,
        decision
      );
      setRetire(null);
      if (decision === "no") setNote(CARDS.retireKept);
    } catch {
      setDecideFailed(true);
    } finally {
      setDeciding(null);
    }
  }

  const winById = new Map(wins.map((w) => [w.id, w]));

  return (
    <section className="mb-8">
      <button
        type="button"
        onClick={() => void runDerive()}
        disabled={busy || deciding !== null}
        className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40"
      >
        {busy ? WINS_DERIVE.workingLabel : WINS_DERIVE.button}
      </button>

      {failed || run?.outcome === "no_derivation" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {WINS_DERIVE.failed}
        </p>
      ) : null}
      {run?.outcome === "no_wins" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {WINS_DERIVE.emptyWall}
        </p>
      ) : null}

      {run?.outcome === "ok" ? (
        <div className="mt-4 space-y-4">
          {/* Window honesty, as prose. A partial read must never look like a
              full one, and neither count ever becomes a meter. */}
          {run.winsRead < run.winsTotal ? (
            <p className="text-xs text-muted-foreground">
              {WINS_DERIVE.partialWindow(run.winsRead, run.winsTotal)}
            </p>
          ) : null}
          {run.alreadyHeld > 0 ? (
            <p className="text-xs text-muted-foreground">
              {WINS_DERIVE.alreadyHeld(run.alreadyHeld)}
            </p>
          ) : null}

          {cards.length === 0 && !retire ? (
            <p className="text-sm text-muted-foreground">
              {WINS_DERIVE.nothingNew}
            </p>
          ) : null}

          {cards.map((card) => {
            const grounding = card.originWinIds
              .map((id) => winById.get(id))
              .filter((w): w is LifeItem => w !== undefined);
            return (
              <PanelCard key={card.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {WINS_DERIVE.proposedTitle}
                  </p>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {CARDS.proposedBadge}
                  </span>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                  {card.title}
                </p>
                {card.body ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {card.body}
                  </p>
                ) : null}

                {grounding.length > 0 ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {WINS_DERIVE.groundingLabel}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {grounding.map((win) => (
                        <li
                          key={win.id}
                          className="truncate text-sm text-muted-foreground"
                        >
                          {win.title || win.body}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void decide(card, "active")}
                    disabled={deciding !== null}
                    className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-40"
                  >
                    {CARDS.approve}
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide(card, "dismissed")}
                    disabled={deciding !== null}
                    className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-40"
                  >
                    {CARDS.dismiss}
                  </button>
                </div>
              </PanelCard>
            );
          })}
        </div>
      ) : null}

      {retire ? (
        <PanelCard className="mt-4">
          {/* The backend's question, verbatim. The approve already landed;
              this only asks about the OLD principle, and no is a full answer
              that is remembered. */}
          <p className="text-[15px] leading-relaxed text-foreground">
            {retire.prompt.question}
          </p>
          {retire.prompt.retiresTitle ? (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {retire.prompt.retiresTitle}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void answerRetire("yes")}
              disabled={deciding !== null}
              className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-40"
            >
              {CARDS.retireYes}
            </button>
            <button
              type="button"
              onClick={() => void answerRetire("no")}
              disabled={deciding !== null}
              className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-40"
            >
              {CARDS.retireNo}
            </button>
          </div>
        </PanelCard>
      ) : null}

      {note ? <p className="mt-3 text-sm text-foreground">{note}</p> : null}
      {decideFailed ? (
        <p className="mt-3 text-sm text-muted-foreground">{STATUS.error}</p>
      ) : null}
    </section>
  );
}
