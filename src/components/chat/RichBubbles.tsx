"use client";

import { Activity, Gauge, Loader2, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  CharismaStress,
  type CharismaStressValue,
} from "@/components/chat/slots";

/* -------------------------------------------------------------------------- */
/*  Rich chat bubbles — the in-chat replacement for the old /results page    */
/*                                                                            */
/*  All variants share a left-anchored bot-bubble look (orange "W"           */
/*  avatar + rounded-2xl card) so they read as the coach talking, not as     */
/*  modals stapled into the thread. Each variant owns its own internal       */
/*  state where useful, but data-fetching + write-back side effects are     */
/*  caller-driven so a parent state machine can sequence things             */
/*  deterministically.                                                       */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Shared bubble shell                                                       */
/* -------------------------------------------------------------------------- */

function BubbleShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex justify-start animate-fade-in-up">
      <div className="flex max-w-[92%] items-start gap-2.5 sm:max-w-[85%]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <span className="text-xs font-bold text-primary-foreground">W</span>
        </div>
        <div
          className={cn(
            "rounded-2xl rounded-tl-sm border border-border bg-chat-bot px-4 py-3 shadow-sm w-full",
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SnippetPlayerBubble                                                       */
/*                                                                            */
/*  Renders one coach-pulled snippet inside the chat stream — the coach      */
/*  insight as a left-bordered quote, the audio player below it, and the     */
/*  type badge in the corner so the user knows whether this is a charisma    */
/*  highlight or a stress moment before they press play.                     */
/* -------------------------------------------------------------------------- */

export interface SnippetPlayerData {
  id: string;
  type: "charisma" | "stress";
  badgeLabel: string;
  insight: string;
  audioUrl: string | null;
  startOffsetMs: number;
  durationMs: number;
}

export function SnippetPlayerBubble({ snippet }: { snippet: SnippetPlayerData }) {
  const isCharisma = snippet.type === "charisma";
  return (
    <BubbleShell>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            isCharisma
              ? "bg-emerald-100 text-emerald-800"
              : "border border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          {snippet.badgeLabel}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {(snippet.durationMs / 1000).toFixed(1)}s
        </span>
      </div>
      <blockquote className="mt-3 border-l-2 border-primary/60 pl-3 text-[13px] italic leading-relaxed text-foreground">
        {snippet.insight}
      </blockquote>
      <div className="mt-3">
        <MediaPlayer
          src={snippet.audioUrl}
          startOffsetMs={snippet.startOffsetMs}
          durationMs={snippet.durationMs}
        />
      </div>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  ActionBubble                                                              */
/*                                                                            */
/*  Inline button row inside the chat — the user makes a choice and the      */
/*  bubble visually confirms which option was tapped (selected one stays      */
/*  highlighted, the rest disable). Caller owns the click handler so it      */
/*  can fire API calls + advance the state machine.                          */
/* -------------------------------------------------------------------------- */

export interface ActionOption {
  /** Stable identifier passed back to the caller's onSelect. */
  value: string;
  /** Display text. */
  label: string;
  /** Optional variant for visual valence. Constrained to the Button
   *  component's accepted variants. */
  variant?: "default" | "outline" | "ghost";
}

export function ActionBubble({
  prompt,
  options,
  selected,
  submitting,
  onSelect,
}: {
  /** Short prompt above the buttons, e.g. "Was this charisma?". */
  prompt: string;
  options: ActionOption[];
  /** Value of the option the user already picked (locked, shown
   *  highlighted). Null = nothing picked yet. */
  selected: string | null;
  /** True while the API call is in flight. Disables every button. */
  submitting: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <BubbleShell>
      <p className="text-[13px] leading-relaxed text-foreground">{prompt}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selected === opt.value;
          const isLocked = selected !== null;
          return (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant={isSelected ? "default" : opt.variant ?? "outline"}
              disabled={(isLocked && !isSelected) || submitting}
              onClick={() => onSelect(opt.value)}
              className={cn(
                "rounded-full text-xs",
                isSelected && "ring-2 ring-primary/40"
              )}
            >
              {submitting && isSelected && (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              )}
              {opt.label}
            </Button>
          );
        })}
      </div>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  SnippetLabelBubble — charisma-vs-stress label, single binary pick         */
/*                                                                            */
/*  Specialised wrapper around the CharismaStress slot for the snippet-       */
/*  review thread. Renders the BubbleShell chrome (W avatar + bot bubble)    */
/*  with a prompt above the binary, then delegates the actual button row    */
/*  to the canonical slot so the visual matches every other place charisma  */
/*  vs stress appears in the app.                                            */
/*                                                                            */
/*  The earlier ActionBubble + ad-hoc option array stays around as a more   */
/*  generic primitive (other binary picks may need it), but the charisma/  */
/*  stress moment now goes through this specialised path.                   */
/* -------------------------------------------------------------------------- */

export function SnippetLabelBubble({
  prompt = "Do you agree with this insight?",
  selected,
  submitting,
  onPick,
  charismaLabel,
  stressLabel,
}: {
  prompt?: string;
  /** Locked value once the user has chosen. Null = nothing picked. */
  selected: CharismaStressValue | null;
  /** True while the parent's label POST is in flight. */
  submitting: boolean;
  onPick: (value: CharismaStressValue) => void;
  /** Optional label overrides per snippet — defaults to "Charisma" /
   *  "Stress" inside the slot. */
  charismaLabel?: string;
  stressLabel?: string;
}) {
  return (
    <BubbleShell>
      <p className="text-[13px] leading-relaxed text-foreground">{prompt}</p>
      <div className="mt-3">
        <CharismaStress
          onPick={onPick}
          selected={selected}
          submitting={submitting}
          charismaLabel={charismaLabel}
          stressLabel={stressLabel}
        />
      </div>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  DashboardBubble — the Calm Anchor                                         */
/*                                                                            */
/*  Drastically pared back per the "Single Surface" spec: archetype label    */
/*  is hard-locked to "The Calm Anchor" (no per-session AI archetyping at    */
/*  this surface), followed by the three trinity bars (POWER, WARMTH,        */
/*  PRESENCE). No narrative, no pace, no sticky topic. The dashboard is     */
/*  meant to be a quiet anchor, not a wall of text.                          */
/* -------------------------------------------------------------------------- */

export interface DashboardBubbleData {
  trinity: { power: number; warmth: number; presence: number };
}

const ARCHETYPE_LABEL = "The Calm Anchor";

export function DashboardBubble({ data }: { data: DashboardBubbleData }) {
  const trinityBars: Array<[string, number]> = [
    ["Power", data.trinity.power],
    ["Warmth", data.trinity.warmth],
    ["Presence", data.trinity.presence],
  ];
  return (
    <BubbleShell>
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-semibold text-foreground">
        <span className="dash-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        {ARCHETYPE_LABEL}
      </span>
      <div className="mt-3 space-y-1.5">
        {trinityBars.map(([label, val]) => {
          const pct = Math.max(0, Math.min(1, val));
          return (
            <div key={label} className="flex items-center gap-2">
              <span className="w-16 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-foreground">
                {Math.round(pct * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  TextBubble — plain bot text in a chat bubble                              */
/* -------------------------------------------------------------------------- */

export function TextBubble({ children }: { children: React.ReactNode }) {
  return (
    <BubbleShell>
      <div className="text-[13px] leading-relaxed text-foreground">{children}</div>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  AcousticMetricsBubble                                                     */
/*                                                                            */
/*  Shown the moment the cold-start recording hits its 30-second cap. Renders*/
/*  raw aggregate acoustic numbers (WPM, pitch, flow, etc.) inside a chat    */
/*  bubble — NO human-coach interpretation yet, that's what the email is    */
/*  for. Drives the "we need a human to give meaning to that raw data" ask  */
/*  immediately below it in the chat thread.                                 */
/* -------------------------------------------------------------------------- */

export interface AcousticMetricsBubbleData {
  /** Words per minute across the full 30s recording. */
  wpm: number | null;
  /** Pitch centre — either a label ("B3") or a number ("195 Hz"). */
  pitch: string | null;
  /** 0..1 — smoothness of delivery (low pauses / fillers = high flow). */
  flow: number | null;
  /** Filler word count for the whole recording. */
  fillers: number | null;
  /** Dynamic range in dB. */
  dynamicDb: number | null;
  /** 0..1 — relative vocal energy. */
  energy: number | null;
}

export function AcousticMetricsBubble({
  metrics,
}: {
  metrics: AcousticMetricsBubbleData;
}) {
  const items: Array<{
    label: string;
    value: string;
    Icon: typeof Activity;
    pctBar?: number;
  }> = [];
  if (metrics.wpm != null) {
    items.push({
      label: "Words / minute",
      value: `${Math.round(metrics.wpm)}`,
      Icon: Gauge,
    });
  }
  if (metrics.pitch) {
    items.push({
      label: "Pitch centre",
      value: metrics.pitch,
      Icon: Waves,
    });
  }
  if (metrics.flow != null) {
    const pct = Math.max(0, Math.min(1, metrics.flow));
    items.push({
      label: "Flow",
      value: `${Math.round(pct * 100)}%`,
      Icon: Activity,
      pctBar: pct,
    });
  }
  if (metrics.fillers != null) {
    items.push({
      label: "Fillers",
      value: String(metrics.fillers),
      Icon: Activity,
    });
  }
  if (metrics.dynamicDb != null) {
    items.push({
      label: "Dynamic range",
      value: `${metrics.dynamicDb.toFixed(1)} dB`,
      Icon: Waves,
    });
  }
  if (metrics.energy != null) {
    const pct = Math.max(0, Math.min(1, metrics.energy));
    items.push({
      label: "Energy",
      value: `${Math.round(pct * 100)}%`,
      Icon: Activity,
      pctBar: pct,
    });
  }

  return (
    <BubbleShell>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Acoustic profile · raw
      </p>
      <h3 className="mt-1 text-base font-semibold text-foreground">
        Here&apos;s what your voice did for the last 30 seconds.
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-background/60 px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <item.Icon className="h-3 w-3" aria-hidden />
              {item.label}
            </div>
            <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
              {item.value}
            </div>
            {item.pctBar != null && (
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${item.pctBar * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <p className="mt-3 text-xs italic text-muted-foreground">
          Acoustic metrics are still being computed.
        </p>
      )}
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  TypingBubble                                                              */
/*                                                                            */
/*  Three bouncing dots inside a bot bubble — used when the chat is waiting */
/*  on a backend response (e.g. compiling acoustic metrics or fetching the  */
/*  KB-backed Q&A answer). Mirrors the bot-bubble look so it reads as the   */
/*  coach "thinking", not a generic spinner.                                 */
/* -------------------------------------------------------------------------- */

export function TypingBubble() {
  return (
    <BubbleShell>
      <div
        className="flex items-center gap-1 px-1 py-1"
        aria-label="Composing reply"
      >
        {[0, 120, 240].map((delay) => (
          <span
            key={delay}
            className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
            style={{
              animation: "fade-in 0.9s ease-in-out infinite alternate",
              animationDelay: `${delay}ms`,
            }}
          />
        ))}
      </div>
    </BubbleShell>
  );
}

