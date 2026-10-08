"use client";

/* -------------------------------------------------------------------------- */
/*  V4's two blind sheets (founder S-B8 A, 2026-10-07; Q-B8 A; build plan      */
/*  D-ML-14), drawn exactly as the signed prototype shows them, in the coach   */
/*  panel's look (the walk overlay, its pill and link, its player):            */
/*                                                                            */
/*    V4MomentPickSheet  "Pick the moment for feedback": up to three moments   */
/*                       of one block, each with its words and its player;    */
/*                       one tap picks ("This one" → "Needs it most"), "Save  */
/*                       my pick" keeps it, "None needs it" is the way out;   */
/*                       then "Thank you. That one is kept." and Next        */
/*    V4SurerSheet       "Which sounds surer": the words said beside the new  */
/*                       version, words only; "Is the new version surer?"     */
/*                       Yes / No / Can't tell; it moves on by itself, and    */
/*                       after the last pair says the line and Next           */
/*                                                                            */
/*  Every word is the backend's signed wording (services/v4_coach_sheets.py   */
/*  WORDING). Blind: no name, no machine pick, no slice, no number (BLIND     */
/*  COACH, AC-9); the only numbers are the sheet's position.                  */
/* -------------------------------------------------------------------------- */

import { useState } from "react";
import { cn } from "@/lib/utils";
import WalkOverlay from "../walk/WalkOverlay";
import SnippetWavePlayer from "../SnippetWavePlayer";
import WalkFooter from "../walk/WalkFooter";
import {
  answerV4MomentPick,
  answerV4Surer,
  type V4MomentPickQueue,
  type V4SurerAnswer,
  type V4SurerQueue,
} from "@/services/api/coachPanel";

const fill = (text: string | undefined, n: number, of: number): string =>
  (text ?? "").replace("{n}", String(n)).replace("{of}", String(of));

function Kept({ line, next, onNext, onClose, testId }: {
  line: string; next: string; onNext: () => void; onClose: () => void; testId: string;
}) {
  return (
    <WalkOverlay onClose={onClose} testId={testId}
      footer={<WalkFooter pill={{ label: next, onClick: onNext, testId: `${testId}-next` }} />}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-7 text-center">
        <h2 className="m-0 text-[24px] font-extrabold leading-[1.2] tracking-[-0.02em]">{line}</h2>
      </div>
    </WalkOverlay>
  );
}

function Card({ chosen = false, header, children }: {
  chosen?: boolean; header: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div data-v4-card className={cn(
      "flex flex-col gap-2.5 rounded-2xl border-[1.5px] px-3.5 py-3 transition-colors",
      chosen ? "border-foreground" : "border-border",
    )}>
      <div className="flex items-center justify-between text-[15px] font-semibold">{header}</div>
      {children}
    </div>
  );
}

export function V4MomentPickSheet({ queue, nextLabel, onClose, onDone }: {
  queue: V4MomentPickQueue;
  /** The panel's own "Next" (signed). */
  nextLabel: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const w = queue.wording;
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kept, setKept] = useState(false);
  const item = queue.items[index] ?? null;

  async function save(input: { clipId: string } | { noneNeedsIt: true }): Promise<void> {
    if (!item || busy) return;
    setBusy(true);
    const saved = await answerV4MomentPick(item.sheetId, input);
    setBusy(false);
    if (saved.ok) setKept(true);
  }

  function next(): void {
    setKept(false);
    setChoice(null);
    if (index + 1 >= queue.items.length) onDone();
    else setIndex(index + 1);
  }

  if (kept || !item) {
    return <Kept line={w.kept ?? ""} next={nextLabel} onNext={item ? next : onDone} onClose={onClose}
      testId="v4-moment-pick-kept" />;
  }
  const footer = (
    <WalkFooter
      pill={{ label: w.save ?? "", onClick: () => choice && void save({ clipId: choice }),
              disabled: busy || !choice, testId: "v4-moment-pick-save" }}
      links={[{ label: w.none ?? "", onClick: () => void save({ noneNeedsIt: true }),
                disabled: busy, testId: "v4-moment-pick-none" }]}
    />
  );
  return (
    <WalkOverlay caption={fill(w.progress, item.n, item.of)} title={w.title ?? ""} subtitle={w.caption ?? ""}
      onClose={onClose} footer={footer} testId="v4-moment-pick">
      <p className="m-0 text-[16px] font-semibold">{w.question ?? ""}</p>
      {item.moments.map((m) => {
        const on = choice === m.clipId;
        return (
          <Card key={m.clipId} chosen={on} header={
            <>
              <span>{(w.moment ?? "{letter}").replace("{letter}", m.letter)}</span>
              <button type="button" disabled={busy} onClick={() => setChoice(m.clipId)}
                data-testid="v4-moment-pick-choice" aria-pressed={on}
                className={cn("walk-press-sm rounded-full border-[1.5px] px-3 py-1 text-[13.5px] font-semibold",
                  on ? "border-foreground bg-foreground text-background" : "border-border")}>
                {on ? (w.needs_it_most ?? "") : (w.this_one ?? "")}
              </button>
            </>
          }>
            {/* The prototype's moment: its words and the one player, no box of its own. */}
            <div className="text-[16.5px] leading-[1.55]" data-testid="v4-moment-words">{m.words}</div>
            <SnippetWavePlayer seed={m.clipId} src={m.audioRef} startOffsetMs={m.startOffsetMs}
              durationMs={m.durationMs} size="compact" tone="ink"
              label={(w.moment ?? "{letter}").replace("{letter}", m.letter)} />
          </Card>
        );
      })}
    </WalkOverlay>
  );
}

function Answer({ label, small = false, onClick, disabled, value }: {
  label: string; small?: boolean; onClick: () => void; disabled: boolean; value: V4SurerAnswer;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-v4-surer-answer={value}
      className={cn("walk-press w-full rounded-full border-[1.5px] border-foreground/15 text-center",
        small ? "p-[9px] text-[14px] font-medium text-muted-foreground" : "p-3.5 text-[16px] font-semibold")}>
      {label}
    </button>
  );
}

export function V4SurerSheet({ queue, nextLabel, onClose, onDone }: {
  queue: V4SurerQueue;
  nextLabel: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const w = queue.wording;
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const item = queue.items[index] ?? null;

  async function answer(value: V4SurerAnswer): Promise<void> {
    if (!item || busy) return;
    setBusy(true);
    const saved = await answerV4Surer(item.sheetId, value);
    setBusy(false);
    if (saved.ok) setIndex(index + 1);
  }

  if (!item) {
    return <Kept line={w.kept ?? ""} next={nextLabel} onNext={onDone} onClose={onClose} testId="v4-surer-kept" />;
  }
  return (
    <WalkOverlay caption={fill(w.progress, item.n, item.of)} title={w.title ?? ""} subtitle={w.caption ?? ""}
      onClose={onClose} testId="v4-surer">
      <Card header={<span>{w.said ?? ""}</span>}>
        <div className="text-[16.5px] leading-[1.55]" data-testid="v4-surer-said">{item.said}</div>
      </Card>
      <Card header={<span>{w.new ?? ""}</span>}>
        <div className="text-[16.5px] leading-[1.55]" data-testid="v4-surer-new">{item.newVersion}</div>
      </Card>
      <p className="m-0 text-[16px] font-semibold">{w.question ?? ""}</p>
      <div className="flex flex-col gap-2">
        <Answer label={w.yes ?? ""} value="yes" disabled={busy} onClick={() => void answer("yes")} />
        <Answer label={w.no ?? ""} value="no" disabled={busy} onClick={() => void answer("no")} />
        <div className="mt-0.5 flex gap-2">
          <Answer small label={w.cant_tell ?? ""} value="cant_tell" disabled={busy}
            onClick={() => void answer("cant_tell")} />
        </div>
      </div>
    </WalkOverlay>
  );
}
