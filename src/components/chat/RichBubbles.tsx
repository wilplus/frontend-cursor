"use client";

import { ChevronDown, Eye, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MediaPlayer from "@/components/results/MediaPlayer";

/* -------------------------------------------------------------------------- */
/*  Rich chat bubbles — the in-chat replacement for the old /results page    */
/*                                                                            */
/*  All four variants share a left-anchored bot-bubble look (orange "W"      */
/*  avatar + rounded-2xl card) so they read as the coach talking, not as     */
/*  modals stapled into the thread. Each variant owns its own internal       */
/*  state where useful (e.g. observation accordion in MirrorBubble), but     */
/*  data-fetching + write-back side effects are caller-driven so a parent    */
/*  state machine can sequence things deterministically.                     */
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
/*  MirrorBubble                                                              */
/*                                                                            */
/*  Coach's running synthesis of the user's last few attempts. Migrated      */
/*  from the standalone MirrorPanel — same data model, same Delete-          */
/*  reflection affordance, just embedded in the chat thread now.             */
/* -------------------------------------------------------------------------- */

export interface MirrorBubbleData {
  headline: string;
  narrative: string;
  observations: string[];
  generatedAt: string;
}

export function MirrorBubble({
  mirror,
  onDelete,
  deleting,
}: {
  mirror: MirrorBubbleData;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [obsOpen, setObsOpen] = useState(false);
  return (
    <BubbleShell>
      <header className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h3 className="font-heading text-lg leading-tight text-foreground">
          {mirror.headline}
        </h3>
      </header>
      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-foreground">
        {mirror.narrative.split(/\n{2,}/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
      {mirror.observations.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setObsOpen((v) => !v)}
            aria-expanded={obsOpen}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Eye className="h-3 w-3" aria-hidden />
            {obsOpen ? "Hide" : "What I'm reading"}
            <ChevronDown
              aria-hidden
              className={cn(
                "h-3 w-3 transition-transform",
                obsOpen && "rotate-180"
              )}
            />
          </button>
          <div
            className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
            style={{
              gridTemplateRows: obsOpen ? "1fr" : "0fr",
              opacity: obsOpen ? 1 : 0,
            }}
          >
            <div className="overflow-hidden">
              <ul className="mt-2 space-y-1 pl-4 text-[12px] text-muted-foreground">
                {mirror.observations.map((o, i) => (
                  <li key={i} className="list-disc">
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      <footer className="mt-3 flex items-center justify-end border-t border-border pt-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive/80 underline-offset-2 hover:text-destructive hover:underline disabled:cursor-wait disabled:opacity-60"
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          {deleting ? "Deleting…" : "Delete reflection"}
        </button>
      </footer>
    </BubbleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  DashboardBubble                                                           */
/*                                                                            */
/*  Compact text-first version of the old CharismaDashboard. SVG triangle    */
/*  and Recharts bar chart don't sit well inside a chat bubble (cramped,     */
/*  awkward responsive behaviour), so we surface the archetype + narrative   */
/*  + a tiny trinity row + a one-line sticky-topic stat. Anyone who wants    */
/*  the full viz can re-introduce it as a modal later — for now this is      */
/*  enough to anchor the review.                                             */
/* -------------------------------------------------------------------------- */

export interface DashboardBubbleData {
  archetype: string;
  narrative: string;
  trinity: { power: number; warmth: number; presence: number };
  acousticsPace: number | null;
  stickyTopic: string | null;
}

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
        {data.archetype}
      </span>
      <blockquote className="mt-3 border-l-2 border-primary pl-3 font-heading text-[15px] italic leading-relaxed text-foreground">
        {data.narrative}
      </blockquote>
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
      {(data.acousticsPace != null || data.stickyTopic) && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {data.acousticsPace != null && (
            <>
              Avg pace{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {Math.round(data.acousticsPace)} wpm
              </span>
            </>
          )}
          {data.acousticsPace != null && data.stickyTopic && " · "}
          {data.stickyTopic && (
            <>
              Sticky topic{" "}
              <span className="font-semibold text-foreground">
                {data.stickyTopic}
              </span>
            </>
          )}
        </p>
      )}
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
