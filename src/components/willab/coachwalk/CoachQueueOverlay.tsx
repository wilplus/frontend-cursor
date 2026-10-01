"use client";

/* -------------------------------------------------------------------------- */
/*  Screen 1 · the Queue (founder 2026-09-30, A7; build plan P2-8).             */
/*                                                                            */
/*  Speakers oldest first, their takes, each moment with one word for where    */
/*  the coach is with it. Before the rating a moment says only "Judge it": the */
/*  kind is not on the row because the backend does not send it (BLIND COACH). */
/*  One link at the bottom opens the error library. Nothing here counts        */
/*  quality (AC-9): the only number is which moment.                          */
/* -------------------------------------------------------------------------- */

import Link from "next/link";
import { ChevronRight, Check } from "lucide-react";
import { SheetFrame } from "../ParagraphSheet";
import { isOpen, stateWord, type QueueSpeaker, type QueueTake } from "@/lib/willab/coachWalk";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";
import type { BlockPickQueue, ErrorAuditQueue } from "@/services/api/coachPanel";

/** The coach's blind lines (6a, 8): drawn only when the backend serves them. */
export interface BlindLines {
  audit: ErrorAuditQueue | null;
  picks: BlockPickQueue | null;
  onOpenAudit: () => void;
  onOpenPicks: () => void;
}

function BlindRow({ title, count, onOpen }: { title: string; count: number; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} data-testid="coach-queue-blind"
      className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-muted">
      <span className="flex flex-col">
        <span className="text-[14px] font-semibold text-foreground">{title}</span>
        <span className="text-[12px] text-muted-foreground">{COPY.queueBlindWaiting(count)}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
    </button>
  );
}

function BlindSection({ blind }: { blind: BlindLines }) {
  const audit = blind.audit && blind.audit.items.length > 0 ? blind.audit : null;
  const picks = blind.picks && blind.picks.items.length > 0 ? blind.picks : null;
  if (!audit && !picks) return null;
  const line = audit?.wording.queue_line ?? picks?.wording.queue_line ?? "";
  return (
    <section className="flex flex-col gap-3" data-testid="coach-queue-blind-section">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{line}</span>
      {audit ? <BlindRow title={audit.wording.title ?? ""} count={audit.items.length} onOpen={blind.onOpenAudit} /> : null}
      {picks ? <BlindRow title={picks.wording.short_title ?? picks.wording.title ?? ""} count={picks.items.length} onOpen={blind.onOpenPicks} /> : null}
    </section>
  );
}

function TakeRows({
  speaker, take, onOpenMoment,
}: {
  speaker: QueueSpeaker;
  take: QueueTake;
  onOpenMoment: (speaker: QueueSpeaker, take: QueueTake, snippetId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
        {COPY.queueTake(take.takeIndex, take.moments.length)}
      </span>
      {take.waitingForText ? (
        <span data-testid="coach-queue-waiting-for-text" className="text-[13px] text-muted-foreground">
          {COPY.queueWaitingForText}
        </span>
      ) : null}
      {take.moments.map((m, i) => {
        const open = isOpen(m.state);
        return (
          <button
            key={m.snippetId}
            type="button"
            onClick={() => onOpenMoment(speaker, take, m.snippetId)}
            data-testid="coach-queue-moment"
            data-state={m.state}
            className={`flex items-center justify-between rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-muted ${
              open ? "" : "opacity-60"
            }`}
          >
            <span className="flex flex-col">
              <span className="text-[14px] font-semibold text-foreground">{COPY.queueMoment(i + 1)}</span>
              <span className="text-[12px] text-muted-foreground">{stateWord(m.state)}</span>
            </span>
            {open ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            ) : (
              <Check className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function CoachQueueOverlay({
  speakers,
  loading,
  onOpenMoment,
  onClose,
  blind = null,
}: {
  speakers: QueueSpeaker[];
  loading: boolean;
  onOpenMoment: (speaker: QueueSpeaker, take: QueueTake, snippetId: string) => void;
  onClose: () => void;
  blind?: BlindLines | null;
}) {
  return (
    <SheetFrame
      title={COPY.queueTitle}
      onClose={onClose}
      footer={
        <Link
          href="/coach/errors"
          className="flex min-h-[48px] items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground"
        >
          {COPY.queueNameError}
        </Link>
      }
    >
      <div className="flex flex-col gap-5" data-testid="coach-queue">
        {speakers.length === 0 && !loading ? (
          <p className="text-[14px] text-muted-foreground">{COPY.queueEmpty}</p>
        ) : null}
        {blind ? <BlindSection blind={blind} /> : null}
        {speakers.map((speaker, i) => (
          <section key={`${speaker.pseudonym}:${i}`} className="flex flex-col gap-3">
            {i > 0 ? (
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {COPY.queueNextSpeaker}
              </span>
            ) : null}
            <h3 className="text-[18px] font-bold text-foreground">{speaker.pseudonym}</h3>
            {speaker.takes.map((take) => (
              <TakeRows key={take.sessionId} speaker={speaker} take={take} onOpenMoment={onOpenMoment} />
            ))}
          </section>
        ))}
      </div>
    </SheetFrame>
  );
}
