"use client";

/* -------------------------------------------------------------------------- */
/*  Screen 3 · Read (founder 2026-09-30, A2; build plan P2-10).                 */
/*                                                                            */
/*  Only now, after the coach's own rating: the passage, both answers, the     */
/*  kind, what fired in words, whether the library has something, and the     */
/*  speaker's goal. Two actions: Answer, Nothing to add. Everything here is a  */
/*  word; no count of anything reaches the screen (AC-9). The backend answers  */
/*  409 before the rating, so this screen cannot draw early.                   */
/* -------------------------------------------------------------------------- */

import { useEffect, useState, type ReactNode } from "react";
import { SheetFrame } from "../ParagraphSheet";
import { FeedbackPagerBar, type Pager } from "../feedbackPager";
import { fetchMomentRead, type MomentRead } from "@/services/api/coachWalk";
import { answerCoachExerciseRequest, type CoachExerciseRequest } from "@/services/api/coachExerciseRequest";
import { answerWord, kindWord, type AnswerValue } from "@/lib/willab/coachWalk";
import { COACH_WALK_COPY as COPY } from "@/lib/willab/coachWalkCopy";

const PILL =
  "flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";
const LINK =
  "flex min-h-[48px] items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";

/** What the library box says, in one sentence. */
export function libraryLine(request: CoachExerciseRequest | null): string {
  if (!request) return COPY.readNoRequest;
  if (request.resolution === "no_safe_match") return COPY.readLibraryNothingToAdd;
  if (request.resolution) {
    return request.shared ? COPY.readLibraryAnsweredShared : COPY.readLibraryAnswered;
  }
  if (request.offeredSince) return COPY.readLibraryOffered;
  if (request.availableExercises.length > 0) return COPY.readLibraryHas;
  return COPY.readLibraryNothing;
}

/** The request is still the coach's to answer. */
export function requestOpen(request: CoachExerciseRequest | null): boolean {
  return request !== null && request.resolution === null;
}

function Chip({ tone, children }: { tone: "kind" | "answer"; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-[12px] font-semibold ${
        tone === "kind" ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function Box({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border px-3 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {eyebrow}
      </span>
      {children}
    </div>
  );
}

function AnswerChips({
  pseudonym, read, coachAnswer,
}: { pseudonym: string; read: MomentRead; coachAnswer: AnswerValue | null }) {
  const kind = kindWord(read.request?.kind ?? null);
  const you = answerWord(read.coachAnswer ?? coachAnswer);
  const speaker = answerWord(read.speakerAnswer);
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="coach-read-chips">
      {kind ? <Chip tone="kind">{kind}</Chip> : null}
      {you ? <Chip tone="answer">{COPY.readYou}: {you}</Chip> : null}
      {speaker ? <Chip tone="answer">{pseudonym}: {speaker}</Chip> : null}
    </div>
  );
}

function ReadBody({ pseudonym, read, coachAnswer }: {
  pseudonym: string; read: MomentRead; coachAnswer: AnswerValue | null;
}) {
  const spotted = read.request?.spotted ?? [];
  return (
    <>
      <AnswerChips pseudonym={pseudonym} read={read} coachAnswer={coachAnswer} />
      {read.passage ? (
        <p className="font-serif text-[17px] leading-[1.5] text-foreground" data-testid="coach-read-passage">
          {read.passage}
        </p>
      ) : null}
      <Box eyebrow={COPY.readHeard}>
        {spotted.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {spotted.map((s) => (
              <span key={s.errorId} className="rounded-full bg-foreground px-2.5 py-0.5 text-[12px] font-medium text-background">
                {s.label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[14px] text-muted-foreground">{COPY.readHeardNothing}</span>
        )}
      </Box>
      <Box eyebrow={COPY.readLibrary}>
        <span className="text-[14px] text-foreground" data-testid="coach-read-library">
          {libraryLine(read.request)}
        </span>
      </Box>
      {read.speakerGoal ? (
        <Box eyebrow={COPY.readGoal(pseudonym)}>
          <span className="text-[14px] text-foreground">{read.speakerGoal}</span>
        </Box>
      ) : null}
    </>
  );
}

export default function CoachReadSheet({
  sessionId,
  snippetId,
  pseudonym,
  pager,
  coachAnswer,
  onClose,
  onAnswer,
  onNothingToAdd,
  onNext,
}: {
  sessionId: string;
  snippetId: string;
  pseudonym: string;
  pager: Pager;
  /** The rating just saved on this walk, before the read confirms it. */
  coachAnswer: AnswerValue | null;
  onClose: () => void;
  /** Answer opens the coach's answer for this request (screens 4 to 6). */
  onAnswer: (request: CoachExerciseRequest) => void;
  /** Nothing to add is saved; the walk moves on. */
  onNothingToAdd: () => void;
  onNext: () => void;
}) {
  const [read, setRead] = useState<MomentRead | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRead(undefined);
    void fetchMomentRead(sessionId, snippetId).then((next) => {
      if (!cancelled) setRead(next);
    });
    return () => { cancelled = true; };
  }, [sessionId, snippetId]);

  async function nothingToAdd(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await answerCoachExerciseRequest(sessionId, snippetId, { resolution: "no_safe_match" });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onNothingToAdd();
  }

  const open = read ? requestOpen(read.request) : false;
  const footer = read === undefined ? null : open && read ? (
    <div className="flex flex-col gap-0.5">
      <button type="button" className={PILL} disabled={busy} onClick={() => read.request && onAnswer(read.request)}>
        {COPY.pillAnswer}
      </button>
      <button type="button" className={LINK} disabled={busy} onClick={() => void nothingToAdd()}>
        {COPY.linkNothingToAdd}
      </button>
      {error ? <p role="alert" className="text-center text-[13px] text-destructive">{error}</p> : null}
    </div>
  ) : (
    <button type="button" className={PILL} onClick={onNext}>
      {pager.index + 1 >= pager.total ? COPY.pillDone : COPY.pillNext}
    </button>
  );

  return (
    <SheetFrame
      title={COPY.readTitle}
      onClose={onClose}
      nav={<FeedbackPagerBar pager={pager} />}
      footer={footer}
    >
      <div className="flex flex-col gap-4" data-testid="coach-read-sheet">
        {read === undefined ? (
          <p className="text-[14px] text-muted-foreground">{COPY.readLoading}</p>
        ) : read === null ? (
          <p role="alert" className="text-[14px] text-muted-foreground">{COPY.readFail}</p>
        ) : (
          <ReadBody pseudonym={pseudonym} read={read} coachAnswer={coachAnswer} />
        )}
      </div>
    </SheetFrame>
  );
}
