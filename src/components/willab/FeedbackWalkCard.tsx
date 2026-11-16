"use client";

import { useMemo, useRef, useState } from "react";
import { MessageSquareText, MonitorPlay } from "lucide-react";
import type { PracticeChunk, PracticeDeliveryLabel } from "@/services/api/trainings";

export type FeedbackWalkChunk = Omit<
  PracticeChunk,
  "attempts" | "deliveryLabel"
> & {
  /** Null until analysis supplies real delivery evidence. */
  attempts: number | null;
  deliveryLabel: PracticeDeliveryLabel | null;
  /** A factual temporary title such as "Take 2" while its slide range lands. */
  pendingLabel?: string;
  /** Neutral workflow state; never a guessed quality judgement. */
  pendingStatus?: string;
};

const QUALITY_TONE: Record<PracticeDeliveryLabel, string> = {
  "Not yet there": "#b66d4c",
  Almost: "#d6a048",
  Good: "#6e9c6c",
  "Strong delivery": "#3f7fbd",
};

function EditableText({ value, label, onCommit, className }: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  className: string;
}) {
  const before = useRef(value);
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label={label}
      className={className}
      onFocus={(event) => { before.current = event.currentTarget.textContent?.trim() || value; }}
      onBlur={(event) => {
        const next = event.currentTarget.textContent?.trim() || before.current;
        event.currentTarget.textContent = next;
        onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.textContent = before.current;
          event.currentTarget.blur();
        }
      }}
    >
      {value}
    </span>
  );
}

function SlideThumbnail({ compact, onOpen }: { compact: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label="Open Ideal text"
      onClick={onOpen}
      className={`relative shrink-0 overflow-hidden rounded-[9px] bg-[#244fc5] ${compact ? "h-[46px] w-[62px]" : "h-[56px] w-[76px]"}`}
    >
      <span aria-hidden className="absolute -inset-2 scale-110 bg-[linear-gradient(135deg,rgba(255,255,255,.24),transparent_42%),linear-gradient(155deg,#5279db_0_24%,#234ac0_24%_56%,#142f99_56%_100%)] blur-[3px]" />
      <span aria-hidden className="absolute left-[9px] top-[12px] h-[2px] w-[23px] rounded bg-white/85" />
      <span aria-hidden className="absolute -bottom-[14px] -right-[10px] h-[34px] w-[34px] rounded-full bg-white/10" />
    </button>
  );
}

export default function FeedbackWalkCard({
  title,
  progress,
  chunks,
  onFeedback,
  onIdealText,
}: {
  title: string;
  progress: number;
  chunks: FeedbackWalkChunk[];
  onFeedback: (chunk: FeedbackWalkChunk) => void;
  onIdealText: (chunk: FeedbackWalkChunk) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(title);
  const [rangeLabels, setRangeLabels] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const latest = chunks.at(-1);
  const selected = chunks.find((chunk) => chunk.latestSessionId === selectedId) ?? latest;
  const visible = expanded ? chunks : latest ? [latest] : [];
  const hidden = Math.max(0, chunks.length - 1);
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const single = chunks.length === 1;
  const attemptsLabel = (attempts: number) => `${attempts} ${attempts === 1 ? "attempt" : "attempts"}`;
  const keys = useMemo(() => new Set(chunks.map((chunk) => chunk.latestSessionId)), [chunks]);

  if (!latest || !selected) return null;

  return (
    <section
      data-feedback-walk-card
      className={`w-full rounded-[22px] bg-[#f5f5f5] text-[#121212] ${single ? "p-[18px]" : "p-3"}`}
    >
      <header className="px-0.5 pb-[5px] pt-px">
        <div className="group flex min-w-0 items-baseline gap-1.5">
          <EditableText
            value={displayTitle}
            label="Edit presentation name"
            onCommit={setDisplayTitle}
            className="w-fit rounded-[5px] text-[18px] font-extrabold tracking-[-0.02em] outline-none focus:bg-white focus:ring-1 focus:ring-[#ff6a14]"
          />
          <span aria-hidden className="text-[11px] font-semibold text-[#737373] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">Click to edit</span>
        </div>
      </header>

      <div className="mb-2 mt-[9px]">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#737373]">
          <span>Progress</span><b className="text-[12px] text-[#121212]">{safeProgress}%</b>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#e8e8e8]" aria-label={`${safeProgress}% progress`}>
          <span className="block h-full rounded-full bg-[#ff6a14]" style={{ width: `${safeProgress}%` }} />
        </div>
      </div>

      {hidden > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mb-[7px] flex min-h-9 w-full items-center justify-center rounded-[11px] border border-dashed border-[#ebebeb] text-[13px] font-semibold text-[#737373] hover:bg-white hover:text-[#121212]"
        >
          {expanded ? "Hide earlier chunks" : `Show ${hidden} earlier chunks`}
        </button>
      ) : null}

      <div className="flex flex-col gap-[7px]">
        {visible.map((chunk, index) => {
          const isLatest = chunk.latestSessionId === latest.latestSessionId;
          const compact = !single;
          const defaultRange = chunk.pendingLabel ?? `Slides ${chunk.startSlide}-${chunk.endSlide}`;
          const range = rangeLabels[chunk.latestSessionId] ?? defaultRange;
          const status = chunk.deliveryLabel ?? chunk.pendingStatus ?? "Processing";
          const statusTone = chunk.deliveryLabel
            ? QUALITY_TONE[chunk.deliveryLabel]
            : "#a3a3a3";
          return (
            <div
              key={chunk.latestSessionId}
              data-practice-chunk
              onClick={() => setSelectedId(chunk.latestSessionId)}
              className={`flex min-w-0 items-center gap-[10px] rounded-[14px] border-l-[3px] bg-white ${single ? "min-h-[78px] p-[11px]" : "p-2"} ${isLatest ? "border-l-[#ff6a14] ring-[1.5px] ring-[#ff6a14]" : "border-l-[#e5e5e5] opacity-70"} ${index ? "mt-1" : ""}`}
            >
              <SlideThumbnail compact={compact} onOpen={() => onIdealText(chunk)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="group flex min-w-0 items-center gap-[5px]">
                    <EditableText
                      value={range}
                      label="Edit slide range"
                      onCommit={(next) => setRangeLabels((current) => keys.has(chunk.latestSessionId) ? { ...current, [chunk.latestSessionId]: next } : current)}
                      className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded text-[14px] font-bold outline-none focus:bg-[#f5f5f5] focus:ring-1 focus:ring-[#ff6a14]"
                    />
                    <span aria-hidden className="text-[11px] font-semibold text-[#737373] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">Edit</span>
                  </span>
                  {chunk.attempts !== null ? (
                    <span className="shrink-0 rounded-full bg-[#ffeadf] px-2 py-[3px] text-[11px] font-bold text-[#ff6727]">{attemptsLabel(chunk.attempts)}</span>
                  ) : null}
                </div>
                <div className="mt-1 inline-flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold text-[#737373]">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: statusTone }} />
                  {status}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onFeedback(selected)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] bg-[#1b1918] px-2 text-[13px] font-semibold text-white">
          <MessageSquareText className="h-[15px] w-[15px]" aria-hidden /> Feedback
        </button>
        <button type="button" onClick={() => onIdealText(selected)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] border border-[#ebebeb] bg-white px-2 text-[13px] font-semibold text-[#121212]">
          <MonitorPlay className="h-[15px] w-[15px]" aria-hidden /> Ideal text
        </button>
      </div>
    </section>
  );
}

// Founder-Approved: readable project-history card, larger type and controls while preserving the locked Feedback/Ideal-text structure, 2026-11-16.
