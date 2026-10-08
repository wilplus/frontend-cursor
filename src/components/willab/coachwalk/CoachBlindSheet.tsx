"use client";

/* -------------------------------------------------------------------------- */
/*  The coach's blind lines (founder 2026-10-01): the error audit (6a, F6)    */
/*  and the block pick (8, C5-b). Each item is sound and one question; the   */
/*  wording comes from the backend's own sheet (D2 for the pick), never a    */
/*  verdict, a name or the machine's choice (BLIND COACH, AC-9). One answer  */
/*  per item, once; the sheet moves on by itself.                            */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { SheetFrame } from "../ParagraphSheet";
import {
  answerBlockPick,
  answerErrorAudit,
  type AuditAnswer,
  type BlockPickQueue,
  type ErrorAuditQueue,
} from "@/services/api/coachPanel";
import { claimPlayback, releasePlayback } from "@/lib/media/exclusivePlayback";
import { useRecoverableSrc } from "@/lib/media/mediaRefresh";

const PILL =
  "flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";
const LINK =
  "flex min-h-[48px] items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";
const SMALL =
  "rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50";
const DARK =
  "rounded-full bg-foreground px-3 py-1.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";

/** The item's sound, the browser's own controls. When the backend says
 *  where the clip sits in its file (start_offset_ms / duration_ms), play
 *  only that window, as MediaPlayer does; without them, the whole file as
 *  before. Plays alone; a dead link asks the host once for a fresh one. */
export function Audio({ src: rawSrc, startOffsetMs = null, durationMs = null }: {
  src: string | null; startOffsetMs?: number | null; durationMs?: number | null;
}) {
  const { src, handleError, handleLoaded } = useRecoverableSrc(rawSrc);
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    return () => releasePlayback(el);
  }, [src]);
  if (!src) return null;
  const startSec = (startOffsetMs ?? 0) / 1000;
  const endSec = durationMs ? startSec + durationMs / 1000 : null;
  const outside = (el: HTMLAudioElement) =>
    el.currentTime < startSec || (endSec !== null && el.currentTime >= endSec);
  return (
    <audio ref={ref} controls preload="none" src={src} className="w-full"
      onLoadedMetadata={(e: SyntheticEvent<HTMLAudioElement>) => {
        handleLoaded();
        if (startSec > 0) e.currentTarget.currentTime = startSec;
      }}
      onPlay={(e: SyntheticEvent<HTMLAudioElement>) => {
        const el = e.currentTarget;
        if (outside(el)) el.currentTime = startSec;
        claimPlayback(el);
      }}
      onPause={(e: SyntheticEvent<HTMLAudioElement>) => releasePlayback(e.currentTarget)}
      onTimeUpdate={(e: SyntheticEvent<HTMLAudioElement>) => {
        const el = e.currentTarget;
        if (endSec !== null && el.currentTime >= endSec) {
          el.pause();
          el.currentTime = startSec;
        }
      }}
      onError={handleError}
    />
  );
}

export function CoachAuditSheet({ queue, onClose, onDone }: {
  queue: ErrorAuditQueue; onClose: () => void; onDone: () => void;
}) {
  const w = queue.wording;
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const item = queue.items[index] ?? null;

  async function answer(value: AuditAnswer): Promise<void> {
    if (!item || busy) return;
    setBusy(true);
    await answerErrorAudit(item.auditId, value);
    setBusy(false);
    if (index + 1 >= queue.items.length) onDone();
    else setIndex(index + 1);
  }

  return (
    <SheetFrame title={w.title ?? ""} onClose={onClose}
      footer={item ? (
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={PILL} disabled={busy} onClick={() => void answer("yes")}>{w.yes ?? "Yes"}</button>
          <button type="button" className={PILL} disabled={busy} onClick={() => void answer("no")}>{w.no ?? "No"}</button>
          <button type="button" className={LINK} disabled={busy} onClick={() => void answer("cant_tell")}>{w.cant_tell ?? ""}</button>
        </div>
      ) : (
        <button type="button" className={PILL} onClick={onDone}>{w.done ?? ""}</button>
      )}
    >
      <div className="flex flex-col gap-4" data-testid="coach-audit-sheet">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">{w.private ?? ""}</span>
        {item ? (
          <>
            <Audio src={item.audioRef} startOffsetMs={item.startOffsetMs} durationMs={item.durationMs} />
            <p className="text-[17px] font-semibold text-foreground" data-testid="coach-audit-question">
              {(w.question ?? "{asks}").replace("{asks}", item.asks || item.label)}
            </p>
          </>
        ) : (
          <p className="text-[14px] text-muted-foreground">{w.done ?? ""}</p>
        )}
      </div>
    </SheetFrame>
  );
}

export function CoachBlockPickSheet({ queue, onClose, onDone }: {
  queue: BlockPickQueue; onClose: () => void; onDone: () => void;
}) {
  const w = queue.wording;
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const item = queue.items[index] ?? null;

  async function save(input: { pickClipId: string } | { cantTell: true }): Promise<void> {
    if (!item || busy) return;
    setBusy(true);
    await answerBlockPick(item.pickId, input);
    setBusy(false);
    setChoice(null);
    if (index + 1 >= queue.items.length) onDone();
    else setIndex(index + 1);
  }

  return (
    <SheetFrame title={w.title ?? ""} onClose={onClose}
      footer={item ? (
        <div className="flex flex-col gap-0.5">
          <button type="button" className={PILL} disabled={busy || !choice}
            onClick={() => choice && void save({ pickClipId: choice })}>
            {w.save ?? ""}
          </button>
          <button type="button" className={LINK} disabled={busy} onClick={() => void save({ cantTell: true })}>
            {w.cant_tell ?? ""}
          </button>
        </div>
      ) : null}
    >
      <div className="flex flex-col gap-4" data-testid="coach-block-pick-sheet">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">{w.private ?? ""}</span>
        {item ? (
          <>
            <span className="text-[12px] text-muted-foreground">
              {(w.progress ?? "").replace("{n}", String(item.n)).replace("{of}", String(item.of))}
            </span>
            <p className="text-[17px] font-semibold text-foreground">{w.question ?? ""}</p>
            <p className="text-[13px] text-muted-foreground">{w.blind_note ?? ""}</p>
            {item.clips.map((c) => (
              <div key={c.clipId} className="flex flex-col gap-1.5 rounded-xl border border-border px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-foreground">
                    {(w.clip ?? "{letter}").replace("{letter}", c.letter)}
                  </span>
                  <button type="button" className={choice === c.clipId ? DARK : SMALL} disabled={busy}
                    onClick={() => setChoice(c.clipId)} data-testid="coach-block-pick-choice">
                    {choice === c.clipId ? (w.most_confident ?? "") : (w.this_one ?? "")}
                  </button>
                </div>
                <Audio src={c.audioRef} startOffsetMs={c.startOffsetMs} durationMs={c.durationMs} />
              </div>
            ))}
          </>
        ) : null}
      </div>
    </SheetFrame>
  );
}
