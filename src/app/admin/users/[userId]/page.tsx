"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Droplet,
  EyeOff,
  Flame,
  Mic,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  Send,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { adminApi, type StudentProfile } from "@/lib/api/admin-client";
import {
  getUserAdminContext,
  updateUserAdminContext,
} from "@/lib/api/client";
import type { UserAdminContext } from "@/lib/api/types";
import { getAuthToken } from "@/lib/api/auth-client";

/* ----------------------------------------------------------------------------
 * Types & helpers
 * ------------------------------------------------------------------------- */

type SessionRow = NonNullable<StudentProfile["sessions"]>[number];

interface AdminSnippet {
  id: string;
  session_id?: string;
  user_id?: string;
  recording_id?: string;
  start_offset_ms: number;
  duration_ms: number;
  /**
   * Legacy column populated by the interview-upload + cold-start
   * extraction paths. Always a fully-formed URL when present.
   */
  audio_segment_path?: string;
  /**
   * Server-resolved playable URL for this snippet — surfaced by the
   * /v2/admin/sessions/<id> endpoint. Prefer this when present: it
   * already accounts for ML-generator rows where audio_segment_path
   * is null but storage_path holds a Supabase Storage key (the
   * backend signs it). Falling back to audio_segment_path keeps the
   * older fetchUserSnippets payload working.
   */
  audio_url?: string | null;
  snippet_type?: string;
  /**
   * Provenance tag from the backend:
   *   - "auto_extracted" — highlight produced by snippet_truncation
   *   - "student"        — user-uploaded clip
   *   - null             — legacy path-B row (hidden from the panel)
   */
  source_type?: string | null;
  admin_comment?: string | null;
  /**
   * Predictive next-question text triggered when the user clicks this
   * snippet's CTA on the /results page. Pre-populated by the backend
   * when the snippet is generated; the admin can override before
   * publishing. Persisted via the same /comment endpoint.
   */
  follow_up_question?: string | null;
  // Spec fields the backend may not yet supply — surfaced where present.
  is_skipped?: boolean | null;
  /**
   * Admin-adjusted trim boundaries in seconds (relative to the start of
   * the audio segment file). Set by the /boundaries endpoint; null means
   * not yet adjusted (original extraction boundaries apply).
   */
  start_time?: number | null;
  end_time?: number | null;
  metrics?: {
    wpm?: number | null;
    pitch?: string | null;
    fillers?: number | null;
    pause_ms?: number | null;
    dynamic_db?: number | null;
    energy_ratio?: number | null;
  } | null;
  /**
   * Post-turn-1 coaching outcome blob, written by
   * services.coaching_outcomes after the user answered the first
   * question of a contextual chat seeded by this snippet's CTA.
   * NULL until that happens. Shape mirrors the backend dict:
   *   { score, evaluator: { score, components, rationale, model },
   *     user_answer: { text, duration_ms, word_count },
   *     question_text, user_id, captured_at, source, version }
   */
  follow_up_outcome?: {
    score?: number | null;
    captured_at?: string | null;
    question_text?: string | null;
    user_answer?: {
      text?: string | null;
      duration_ms?: number | null;
      word_count?: number | null;
    } | null;
    evaluator?: {
      score?: number | null;
      rationale?: string | null;
      components?: {
        specificity?: number | null;
        emotional_movement?: number | null;
        engagement?: number | null;
      } | null;
    } | null;
  } | null;
}

function formatRange(startMs: number, durationMs: number): string {
  const fmt = (ms: number) => {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };
  return `${fmt(startMs)} – ${fmt(startMs + durationMs)}`;
}

function formatSessionDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function displayName(p: StudentProfile | null): string {
  if (!p) return "User";
  return (
    (p.name && p.name.trim()) ||
    (p.email && p.email.trim()) ||
    p.user_id
  );
}

/* ----------------------------------------------------------------------------
 * Sub-components
 * ------------------------------------------------------------------------- */

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

interface AudioPlayerProps {
  src?: string | null;
  duration?: string;
  label?: string;
}

/**
 * Visual audio player matching the spec layout. Falls back to native <audio>
 * for the actual playback so we don't reinvent timeline scrubbing.
 *
 * Surfaces broken sources with a visible badge instead of a silent 0:00
 * player — same UX contract as SnippetPreviewPlayer + PlayableAudio.
 */
function AudioPlayer({ src, duration, label }: AudioPlayerProps) {
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setErrored(false);
  }, [src]);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      {label && (
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {label}
        </p>
      )}
      {src && !errored ? (
        <audio
          controls
          src={src}
          controlsList="nodownload"
          className="w-full"
          onError={() => setErrored(true)}
        />
      ) : errored ? (
        <div
          className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
          role="status"
          title={`Audio failed to load. Source: ${src}`}
        >
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
          <span className="text-xs font-medium text-amber-900">
            Audio unavailable — source returned 404 (stale reference)
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            ▶
          </div>
          <div className="h-1.5 flex-1 rounded-full bg-border">
            <div className="h-full w-0 rounded-full bg-primary" />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {duration ?? "—"}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Snippet audio player with optional start/end clamping so admins can
 * instantly hear the effect of a boundary adjustment without re-loading the
 * page.
 *
 * `seekTo`  — seconds into the file to jump to on every play event.
 * `clipEnd` — seconds into the file at which playback is paused and reset to
 *             `seekTo`. When undefined the player plays to the natural end of
 *             the audio file.
 *
 * Both values update reactively: when the admin clicks ±0.5s / ±1s and the
 * API responds, the parent re-renders with new seekTo/clipEnd and the player
 * reflects the new trim on the next press of play.
 */
function SnippetPreviewPlayer({
  src,
  seekTo = 0,
  clipEnd,
}: {
  src?: string | null;
  seekTo?: number;
  clipEnd?: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  // True when the <audio> element fires `error` — usually means the
  // resource returned 404 (stale R2 / Supabase reference). We render a
  // visible badge instead of a silent 0:00 player so the admin knows
  // the audio is gone and not their browser misbehaving. Reset whenever
  // `src` changes so re-fetched URLs get a fair retry.
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setErrored(false);
  }, [src]);

  // Whenever boundaries change (after API response), pre-position the
  // playhead so the admin can immediately press play at the right spot.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !el.paused) return;
    el.currentTime = seekTo;
  }, [seekTo]);

  const handlePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    // Jump to trimmed start if the playhead is outside the trimmed window.
    if (
      el.currentTime < seekTo ||
      (clipEnd != null && el.currentTime >= clipEnd)
    ) {
      el.currentTime = seekTo;
    }
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || clipEnd == null) return;
    if (el.currentTime >= clipEnd) {
      el.pause();
      el.currentTime = seekTo;
    }
  };

  if (!src) {
    return (
      <div className="flex h-10 items-center rounded-xl border border-border bg-muted/30 px-3">
        <span className="text-xs text-muted-foreground">No audio available</span>
      </div>
    );
  }

  if (errored) {
    return (
      <div
        className="flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3"
        role="status"
        title={`Audio failed to load. Source: ${src}`}
      >
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
        <span className="text-xs font-medium text-amber-900">
          Audio unavailable — source returned 404 (stale reference)
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <audio
        ref={audioRef}
        controls
        src={src}
        controlsList="nodownload"
        className="w-full"
        onPlay={handlePlay}
        onTimeUpdate={handleTimeUpdate}
        onError={() => setErrored(true)}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Right-aligned "user voice answer" bubble used in the Chat Transcript &
 * Override tab. Preserves the spec's orange-pill chat styling but flips
 * to an amber badge — keeping the right-alignment and Mic icon — when
 * the audio source fails to load. Same broken-source UX as the rest of
 * the page so admins get a consistent signal across tabs.
 * ------------------------------------------------------------------------- */

function TranscriptUserAudioBubble({
  src,
  durationMs,
  startOffsetMs,
  turnNumber,
  turnTotal,
}: {
  src: string;
  durationMs: number | null | undefined;
  /** Offset (ms) within `src` that this turn begins at. ZERO when src
   *  is the per-turn original file; non-zero when src falls back to
   *  the concat'd full.webm (e.g. legacy rows where audio_segment_path
   *  was NULL'd by an earlier finalize). When non-zero we clamp the
   *  <audio> playback to (start, start + duration) so the bubble still
   *  plays the right slice. */
  startOffsetMs?: number | null;
  /** 1-based position of this answer in the interview (e.g. 2). */
  turnNumber?: number | null;
  /** Total number of answers in the interview — used for "N / M" labeling. */
  turnTotal?: number | null;
}) {
  const [errored, setErrored] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    setErrored(false);
  }, [src]);

  const seekSec = Math.max(0, (startOffsetMs ?? 0) / 1000);
  const clipEndSec =
    durationMs != null && durationMs > 0
      ? seekSec + durationMs / 1000
      : undefined;

  // Pre-position the playhead so pressing play starts at the turn's offset.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !el.paused) return;
    if (seekSec > 0) {
      try {
        el.currentTime = seekSec;
      } catch {
        /* metadata not loaded yet — onLoadedMetadata handles it */
      }
    }
  }, [src, seekSec]);

  const handleLoadedMetadata = () => {
    const el = audioRef.current;
    if (el && seekSec > 0 && el.currentTime < seekSec) {
      el.currentTime = seekSec;
    }
  };

  const handlePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (
      el.currentTime < seekSec ||
      (clipEndSec != null && el.currentTime >= clipEndSec)
    ) {
      el.currentTime = seekSec;
    }
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || clipEndSec == null) return;
    if (el.currentTime >= clipEndSec) {
      el.pause();
      el.currentTime = seekSec;
    }
  };

  // "Turn 1 / 3" when both numbers known, "Turn 1" when only the index is.
  const turnLabel = (() => {
    if (turnNumber == null) return null;
    if (turnTotal != null && turnTotal > 0) return `Turn ${turnNumber} / ${turnTotal}`;
    return `Turn ${turnNumber}`;
  })();

  if (errored) {
    return (
      <div className="flex justify-end">
        <div
          className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-br-sm border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 shadow-sm"
          role="status"
          title={`Audio failed to load. Source: ${src}`}
        >
          <Mic className="h-4 w-4 shrink-0" aria-hidden />
          {turnLabel && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">
              {turnLabel}
            </span>
          )}
          <span className="text-xs font-medium">
            Audio unavailable — source returned 404 (stale reference)
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground shadow-sm">
        <Mic className="h-4 w-4 shrink-0" aria-hidden />
        {turnLabel && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/85"
            aria-label="Turn position"
          >
            {turnLabel}
          </span>
        )}
        <audio
          ref={audioRef}
          controls
          src={src}
          preload="metadata"
          className="h-8 max-w-[220px]"
          onError={() => setErrored(true)}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onTimeUpdate={handleTimeUpdate}
        />
        {durationMs != null && (
          <span className="text-[11px] tabular-nums opacity-90">
            {(durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Minimal audio player for places that don't need trim/seek — Conversation
 * Timeline turn audio, Full Recording, etc. Shares the same broken-source
 * badge UX as SnippetPreviewPlayer so the admin sees a consistent signal
 * regardless of which player surfaces the 404.
 * ------------------------------------------------------------------------- */

function PlayableAudio({
  src,
  className,
}: {
  src?: string | null;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (!src) {
    return (
      <p className="text-xs text-muted-foreground">No audio available.</p>
    );
  }

  if (errored) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
        role="status"
        title={`Audio failed to load. Source: ${src}`}
      >
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
        <span className="text-xs font-medium text-amber-900">
          Audio unavailable — source returned 404 (stale reference)
        </span>
      </div>
    );
  }

  return (
    <audio
      controls
      preload="metadata"
      src={src}
      className={className ?? "w-full"}
      onError={() => setErrored(true)}
    />
  );
}

/* ----------------------------------------------------------------------------
 * 3-dots dropdown (Archive / Delete) — minimal click-outside-closes pattern
 * ------------------------------------------------------------------------- */

function HeaderMenu({
  onArchive,
  onDelete,
}: {
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="rounded-full"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onArchive();
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
          >
            Archive User
          </button>
          <div className="h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            Delete User
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Snippet card (TAB 1 child of each session recording)
 * ------------------------------------------------------------------------- */

interface SnippetCardProps {
  snippet: AdminSnippet;
  onAdjustBounds: (
    snippetId: string,
    edge: "start" | "end",
    deltaMs: number
  ) => void;
  onLabel: (snippetId: string, type: "charisma" | "stress") => void;
  /** Saves admin_comment + follow_up_question + (current) snippet_type. */
  onSaveComment: (
    snippetId: string,
    comment: string,
    followUpQuestion: string
  ) => Promise<void>;
  onSkip: (snippetId: string) => void;
  saving?: boolean;
  /** Disable boundary +/- controls (e.g. while saving). */
  boundaryDisabled?: boolean;
  skipDisabled?: boolean;
}

/**
 * Compact readout of a coaching outcome — what the user actually said
 * in response to THIS snippet's contextual chat, and how the evaluator
 * scored their answer. Rendered only when follow_up_outcome is non-null
 * (i.e. the user has answered turn 1 of a chat seeded by this snippet's
 * CTA). The composite score colour-codes the strip; tooltip exposes the
 * rationale + per-component scores so the admin can see WHY the model
 * scored what it did.
 */
function CoachingOutcomeStrip({
  outcome,
}: {
  outcome: NonNullable<AdminSnippet["follow_up_outcome"]>;
}) {
  const score = Number(outcome.score ?? outcome.evaluator?.score ?? 0);
  const answer = (outcome.user_answer?.text || "").trim();
  const wordCount = outcome.user_answer?.word_count ?? null;
  const durationSec =
    outcome.user_answer?.duration_ms != null
      ? (outcome.user_answer.duration_ms / 1000).toFixed(1)
      : null;
  const rationale = (outcome.evaluator?.rationale || "").trim();
  const components = outcome.evaluator?.components ?? null;
  const capturedAt = outcome.captured_at
    ? new Date(outcome.captured_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Tier colour bands match the rule from the previous design pass.
  let bandClass = "border-amber-200 bg-amber-50";
  let pillClass = "bg-amber-100 text-amber-900";
  if (score >= 0.7) {
    bandClass = "border-emerald-200 bg-emerald-50";
    pillClass = "bg-emerald-600 text-white";
  } else if (score < 0.4) {
    bandClass = "border-destructive/20 bg-destructive/5";
    pillClass = "bg-destructive/10 text-destructive";
  }

  const componentSummary = components
    ? [
        ["Specificity", components.specificity],
        ["Emotional movement", components.emotional_movement],
        ["Engagement", components.engagement],
      ]
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => `${k}: ${(Number(v) * 100).toFixed(0)}%`)
        .join(" · ")
    : "";

  const tooltipText = [rationale, componentSummary].filter(Boolean).join("\n\n");

  return (
    <div
      className={`rounded-xl border ${bandClass} p-3 space-y-2`}
      title={tooltipText || undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            User responded
          </span>
          <span
            className={`inline-flex items-center rounded-full ${pillClass} px-2 py-0.5 text-xs font-semibold tabular-nums`}
            aria-label="Coaching effectiveness score"
          >
            {(score * 100).toFixed(0)}/100
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
          {wordCount != null && <span>{wordCount} words</span>}
          {durationSec != null && <span>· {durationSec}s</span>}
          {capturedAt && <span>· {capturedAt}</span>}
        </div>
      </div>
      {answer && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
          &ldquo;{answer}&rdquo;
        </p>
      )}
      {rationale && (
        <p className="text-xs italic text-muted-foreground">{rationale}</p>
      )}
    </div>
  );
}

function SnippetCard({
  snippet,
  onAdjustBounds,
  onLabel,
  onSaveComment,
  onSkip,
  saving,
  boundaryDisabled,
  skipDisabled,
}: SnippetCardProps) {
  const [comment, setComment] = useState(snippet.admin_comment ?? "");

  const isSkipped = !!snippet.is_skipped;

  // Effective trim boundaries in seconds (relative to the audio file start).
  // start_time / end_time are populated by the /boundaries API after the first
  // admin adjustment. Before that, default to file-start / natural file-end.
  const effectiveStartSec =
    snippet.start_time != null ? snippet.start_time : 0;
  const effectiveEndSec =
    snippet.end_time != null
      ? snippet.end_time
      : snippet.duration_ms / 1000;

  // Seek position and clip-end passed to the audio player so it plays only
  // the trimmed window without requiring a page reload.
  const seekTo = effectiveStartSec;
  const clipEnd = effectiveEndSec;

  // Boundary controls per spec — 4 buttons: ±2s on Start, ±2s on End.
  const boundaryActions: Array<{
    edge: "start" | "end";
    deltaMs: number;
    Icon: typeof Minus;
    label: string;
  }> = [
    { edge: "start", deltaMs: -2000, Icon: Minus, label: "2s Start" },
    { edge: "start", deltaMs: 2000, Icon: Plus, label: "2s Start" },
    { edge: "end", deltaMs: -2000, Icon: Minus, label: "2s End" },
    { edge: "end", deltaMs: 2000, Icon: Plus, label: "2s End" },
  ];

  return (
    <Card
      key={snippet.id}
      className={`rounded-2xl border-border ${
        isSkipped ? "opacity-50 transition-opacity" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span>
              Snippet {formatRange(snippet.start_offset_ms, snippet.duration_ms)}
            </span>
            {/* Live snippet length — re-renders the moment
                handleAdjustBounds updates start_offset_ms / duration_ms,
                so the admin sees the new total immediately after each
                ±2s click without needing to do the math from the range. */}
            <span
              className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary"
              aria-label="Snippet length"
              title="Current snippet length (updates as bounds are adjusted)"
            >
              {(snippet.duration_ms / 1000).toFixed(1)}s
            </span>
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {snippet.metrics?.wpm != null && (
              <Badge variant="outline" className="bg-muted">
                WPM: {snippet.metrics.wpm}
              </Badge>
            )}
            {snippet.metrics?.pitch && (
              <Badge variant="outline" className="bg-muted">
                Pitch: {snippet.metrics.pitch}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mini audio player — plays only within the admin-adjusted trim window.
            Prefer the backend-resolved audio_url (handles ML-generator rows
            via Supabase signed URL); fall back to audio_segment_path for
            older fetchUserSnippets payloads. */}
        <SnippetPreviewPlayer
          src={snippet.audio_url ?? snippet.audio_segment_path}
          seekTo={seekTo}
          clipEnd={clipEnd}
        />

        {/* Boundary controls (±2s Start, ±2s End) */}
        <div className="flex flex-wrap gap-2">
          {boundaryActions.map(({ edge, deltaMs, Icon, label }) => (
            <Button
              key={`${edge}-${deltaMs}`}
              type="button"
              variant="outline"
              size="sm"
              disabled={boundaryDisabled}
              onClick={() => onAdjustBounds(snippet.id, edge, deltaMs)}
            >
              <Icon className="h-3 w-3" /> {label}
            </Button>
          ))}
        </div>

        {/* Labeling buttons (Charisma / Stress) — visual state mirrors
            snippet.snippet_type so the admin can listen to the audio
            first and then label, with the currently-selected label
            visibly "filled". The previous version hardcoded Charisma
            to solid green and Stress to outline-red regardless of
            actual state, so it always looked like Charisma was the
            saved label even when nothing had been chosen. */}
        <div className="flex flex-wrap gap-2">
          {(() => {
            const current = (snippet.snippet_type || "").toLowerCase();
            const isCharisma = current === "charisma";
            const isStress = current === "stress";
            return (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={isCharisma ? "default" : "outline"}
                  onClick={() => onLabel(snippet.id, "charisma")}
                  aria-pressed={isCharisma}
                  className={
                    isCharisma
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
                      : "border-emerald-600/40 text-emerald-700 hover:bg-emerald-50"
                  }
                >
                  <Flame className="h-3.5 w-3.5" /> Charisma
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isStress ? "default" : "outline"}
                  onClick={() => onLabel(snippet.id, "stress")}
                  aria-pressed={isStress}
                  className={
                    isStress
                      ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive"
                      : "border-destructive/30 text-destructive hover:bg-destructive/10"
                  }
                >
                  <Droplet className="h-3.5 w-3.5" /> Stress
                </Button>
              </>
            );
          })()}
        </div>

        {/* Admin comment — published verbatim to the user's /results page */}
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Coach's insight..."
          className="bg-background min-h-[80px]"
        />

        {/* Coaching-outcome readout. Present iff the user has clicked
            this snippet's CTA and answered turn 1 of the contextual
            chat. Closes the feedback loop for the admin: they see
            the consequence of THIS snippet's comment — the score the
            evaluator gave, the words the user actually said back, and
            (on hover) the rationale for the score. Composite score
            colour-codes the strip; the user's reply is the most
            useful artefact, so it gets the largest treatment. */}
        {snippet.follow_up_outcome && (
          <CoachingOutcomeStrip outcome={snippet.follow_up_outcome} />
        )}

        {/* Action footer (Save / Skip) */}
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() =>
              // Preserve any backend-supplied follow_up_question — the
              // current spec drops the dedicated textarea, so we round-trip
              // the existing value untouched rather than clobbering it.
              void onSaveComment(
                snippet.id,
                comment,
                snippet.follow_up_question ?? ""
              )
            }
            className="rounded-full px-4"
          >
            {saving ? "Saving…" : "Save Snippet"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={skipDisabled}
            onClick={() => onSkip(snippet.id)}
            className="text-muted-foreground"
          >
            <EyeOff className="h-3.5 w-3.5" />
            {isSkipped ? "Skipped" : "Skip Snippet"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
 * Main page
 * ------------------------------------------------------------------------- */

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId =
    typeof params?.userId === "string"
      ? params.userId
      : Array.isArray(params?.userId)
        ? params.userId[0]
        : "";

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [context, setContext] = useState<UserAdminContext | null>(null);
  const [snippets, setSnippets] = useState<AdminSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab 3 — saved separately so we can show "Saving…" per textarea.
  const [adminNotes, setAdminNotes] = useState("");
  const [llmInstructions, setLlmInstructions] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingInstructions, setSavingInstructions] = useState(false);

  // Per-snippet save state.
  const [savingSnippetId, setSavingSnippetId] = useState<string | null>(null);

  // Timeline / AI summary (fetched when session is known).
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [interviewTurns, setInterviewTurns] = useState<Array<{
    /** Stable PK from the backend timeline payload — used to PATCH the
     *  question text via /api/v2/admin/turns/[turnId]/question. */
    id?: string | null;
    turn_number: number | null;
    question: { text: string | null; tone: string | null };
    /** Whisper transcript may live under any of these keys depending on
     *  backend version — surface whichever is present at render time. */
    answer: {
      audio_url: string | null;
      duration_ms: number | null;
      /** Offset (ms) within audio_url at which this turn begins. Backend
       *  returns 0 when audio_url is the per-turn original file; non-zero
       *  when audio_url is the concat'd full.webm and we need to seek. */
      start_offset_ms?: number | null;
      transcript?: string | null;
      transcript_text?: string | null;
      transcription?: string | null;
    };
    transcript?: string | null;
  }>>([]);
  /** Index of the turn currently in edit mode (null = none being edited). */
  const [editingTurnIdx, setEditingTurnIdx] = useState<number | null>(null);
  const [editingTurnDraft, setEditingTurnDraft] = useState("");
  const [savingTurnIdx, setSavingTurnIdx] = useState<number | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      adminApi.getStudentProfile(userId),
      getUserAdminContext(userId),
      fetchUserSnippets(userId),
    ])
      .then(([profileRes, contextRes, snippetsRes]) => {
        if (cancelled) return;
        if (profileRes.status === "fulfilled") {
          setProfile(profileRes.value);
        } else {
          setError(
            profileRes.reason instanceof Error
              ? profileRes.reason.message
              : "Failed to load user profile."
          );
        }
        if (contextRes.status === "fulfilled") {
          setContext(contextRes.value);
          setAdminNotes(contextRes.value.general_notes ?? "");
          setLlmInstructions(contextRes.value.custom_instructions ?? "");
        }
        if (snippetsRes.status === "fulfilled") {
          setSnippets(snippetsRes.value);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* -------------------------------------------------------------------- */
  /* Latest session + metrics                                              */
  /* -------------------------------------------------------------------- */

  const latestSession: SessionRow | null = useMemo(() => {
    const sorted = [...(profile?.sessions ?? [])].sort((a, b) =>
      (b.completed_at || b.created_at || "").localeCompare(
        a.completed_at || a.created_at || ""
      )
    );
    return sorted[0] ?? null;
  }, [profile]);

  const sessionSnippets = useMemo(() => {
    if (!latestSession) return [];
    // The snippet panel is a highlight reel — auto-extracted moments
    // produced by services.snippet_truncation, plus student-uploaded
    // clips. Turn rows (turn_number IS NOT NULL) belong in the Chat
    // Transcript / Conversation Timeline. We also exclude legacy
    // path-B rows (turn_number NULL, source_type NULL) — those are
    // stale leftovers from older code paths and the user reported them
    // showing up as bogus "duplicate" cards alongside the real
    // highlights.
    return snippets.filter((s) => {
      if (s.session_id !== latestSession.id) return false;
      const tn = (s as { turn_number?: number | null }).turn_number;
      if (tn !== null && tn !== undefined) return false;
      const src = (s as { source_type?: string | null }).source_type;
      // Recognised origin tags for a highlight card. Anything else
      // (NULL, unknown extractor variants) is legacy noise we hide.
      return src === "auto_extracted" || src === "student";
    });
  }, [snippets, latestSession]);

  // Fetch timeline (AI summary + interview turns) + recording playback URL
  useEffect(() => {
    if (!latestSession?.id || !userId) return;
    let cancelled = false;

    // Timeline + snippets — fetched from the new comprehensive admin
    // session endpoint, which eager-loads turns and snippets in one
    // round-trip. The legacy /admin/users/<id>/timeline endpoint
    // returned the empty-turn case for extraction-only sessions
    // (single recording, no interview Q&A), which is why this section
    // used to render "No interview turns recorded" even when the
    // recording had been processed and snippets existed.
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token || cancelled) return;
        const res = await fetch(
          `/api/v2/admin/sessions/${latestSession.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          global_metrics?: {
            ai_summary?: string | null;
            ai_score?: number | null;
          };
          turns?: Array<{
            role?: "ai" | "user";
            content?: string | null;
            tone?: string | null;
            audio_url?: string | null;
            duration_ms?: number | null;
            /** Backend echoes 0 when audio_url is the per-turn original,
             *  or the row's actual start_offset_ms when audio_url falls
             *  back to the concat'd full.webm. */
            start_offset_ms?: number | null;
            snippet_id?: string | null;
            turn_number?: number | null;
          }>;
          snippets?: Array<unknown>;
        };
        if (cancelled) return;

        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.log("[admin/sessions] response:", data);
        }

        setAiSummary(data.global_metrics?.ai_summary ?? null);
        setAiScore(data.global_metrics?.ai_score ?? null);

        // ── Reshape flat turns → legacy nested shape ─────────────────
        // The new endpoint returns a flat list alternating
        // {role:"ai", content, tone, turn_number} and {role:"user",
        // content, audio_url, ...}. The render code below was written
        // for a nested {question, answer} shape, so we pair adjacent
        // ai/user messages by turn_number here rather than rewriting
        // the JSX.
        const flat = Array.isArray(data.turns) ? data.turns : [];
        const nested: typeof interviewTurns = [];
        let i = 0;
        while (i < flat.length) {
          const cur = flat[i];
          const next = flat[i + 1];
          if (
            cur.role === "ai" &&
            next?.role === "user" &&
            cur.turn_number != null &&
            cur.turn_number === next.turn_number
          ) {
            nested.push({
              id: next.snippet_id ?? null,
              turn_number: next.turn_number ?? null,
              question: { text: cur.content ?? null, tone: cur.tone ?? null },
              answer: {
                audio_url: next.audio_url ?? null,
                duration_ms: next.duration_ms ?? null,
                start_offset_ms: next.start_offset_ms ?? 0,
                transcript: next.content ?? null,
              },
            });
            i += 2;
          } else if (cur.role === "user") {
            nested.push({
              id: cur.snippet_id ?? null,
              turn_number: cur.turn_number ?? null,
              question: { text: null, tone: null },
              answer: {
                audio_url: cur.audio_url ?? null,
                duration_ms: cur.duration_ms ?? null,
                start_offset_ms: cur.start_offset_ms ?? 0,
                transcript: cur.content ?? null,
              },
            });
            i += 1;
          } else {
            nested.push({
              id: null,
              turn_number: cur.turn_number ?? null,
              question: { text: cur.content ?? null, tone: cur.tone ?? null },
              answer: {
                audio_url: null,
                duration_ms: null,
                transcript: null,
              },
            });
            i += 1;
          }
        }

        // ── Snippet fallback for extraction-only sessions ────────────
        // If the session has no proper interview turns (cold-start
        // funnel: one recording, no Q&A loop), promote the extracted
        // snippets to pseudo-turns so the transcript area still shows
        // useful content.
        //
        // Important filter: ML-generator candidate rows (from
        // charisma_snippet_service) populate `storage_path` but not
        // `audio_segment_path`, and don't carry a `transcript` either.
        // They belong in the snippet panel below, not the conversation
        // timeline. Promoting them here was producing the misleading
        // "TURN 1, no audio recorded, transcript still processing"
        // card. We now require a playable audio_url before treating a
        // snippet as a renderable pseudo-turn.
        const rawSnippets = Array.isArray(data.snippets) ? data.snippets : [];
        if (nested.length === 0) {
          for (const raw of rawSnippets) {
            const s = raw as {
              id?: string | null;
              audio_url?: string | null;
              duration_ms?: number | null;
              transcript?: string | null;
              turn_number?: number | null;
              is_skipped?: boolean;
            };
            if (s.is_skipped) continue;
            // Skip ML candidates with no playable audio — they're not
            // turns, they're auto-extracted moments.
            if (!s.audio_url) continue;
            nested.push({
              id: s.id ?? null,
              turn_number: s.turn_number ?? null,
              question: { text: null, tone: null },
              answer: {
                audio_url: s.audio_url ?? null,
                duration_ms: s.duration_ms ?? null,
                transcript: s.transcript ?? null,
              },
            });
          }
        }

        setInterviewTurns(nested);

        // The new endpoint always nests snippets — prefer them over
        // the standalone fetchUserSnippets() result so the snippet
        // panel matches the session we just loaded.
        if (rawSnippets.length > 0) {
          setSnippets(rawSnippets as AdminSnippet[]);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[admin/sessions] fetch failed:", err);
      }
    })();

    // Recording playback URL
    const recId =
      (latestSession as Record<string, unknown>).recording_1_id ??
      (latestSession.recording_preview as Record<string, unknown> | undefined)
        ?.recording_id;
    if (recId && typeof recId === "string") {
      (async () => {
        try {
          const token = await getAuthToken();
          if (!token || cancelled) return;
          const res = await fetch(
            `/api/v2/admin/recordings/${recId}/playback-url`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok || cancelled) return;
          const data = await res.json();
          // Backend returns { audio_url } (see v2_admin_recording_playback_url
          // in routes/v2_routes.py); also accept legacy `url` for forward
          // compatibility if the shape ever flips.
          const url = (data?.audio_url ?? data?.url) as string | undefined;
          if (!cancelled && url) setRecordingUrl(url);
        } catch {
          /* non-fatal */
        }
      })();
    }

    return () => { cancelled = true; };
  }, [latestSession, userId]);

  /** Aggregate metrics for the latest session, drawn from the row's
   *  recording_preview + sniper_metrics. Anything missing is shown as "—". */
  const sessionMetrics = useMemo(() => {
    const r = latestSession?.recording_preview ?? {};
    const sn = latestSession?.sniper_metrics ?? {};
    const num = (v: unknown, decimals = 0): string =>
      typeof v === "number" && Number.isFinite(v) ? v.toFixed(decimals) : "—";
    const wpm =
      r?.words_per_minute ?? r?.wpm ?? sn?.wpm ?? latestSession?.words_per_minute ?? null;
    const fillers = r?.filler_words_count?.total ?? null;
    const pauseSec = sn?.pause_ms != null ? sn.pause_ms / 1000 : null;
    const dynamicDb = sn?.dynamic_db ?? null;
    const energyRatio = sn?.energy_ratio ?? null;
    const pitchSt = sn?.pitch_center_st ?? null;
    return [
      { label: "WPM", value: num(wpm) },
      { label: "Fillers", value: num(fillers) },
      { label: "Pause", value: pauseSec == null ? "—" : `${num(pauseSec, 1)}s` },
      { label: "Dynamic dB", value: num(dynamicDb, 1) },
      { label: "Pitch", value: num(pitchSt, 1) },
      {
        label: "Energy",
        value: energyRatio == null ? "—" : `${Math.round(energyRatio * 100)}%`,
      },
    ];
  }, [latestSession]);

  /**
   * Canonical session KPI score (0.0–1.0) computed by the backend after each
   * session — same value rendered as a percentage in CompletedCard /
   * KPILineChart. Lives inside performance_metrics_v2 on the session row;
   * we walk the common shapes defensively because the admin endpoint may
   * return either nested-under-performance_score or flattened.
   */
  const finalKpi = useMemo<number | null>(() => {
    const candidates: Array<Record<string, unknown> | null | undefined> = [
      latestSession?.performance_metrics_v2,
      latestSession?.recording_preview?.performance_metrics_v2,
    ];
    for (const blob of candidates) {
      if (!blob) continue;
      const ps = (blob as { performance_score?: unknown }).performance_score;
      if (ps && typeof ps === "object") {
        const k = (ps as { final_kpi?: unknown }).final_kpi;
        if (typeof k === "number" && Number.isFinite(k)) return k;
      }
      const flat = (blob as { final_kpi?: unknown }).final_kpi;
      if (typeof flat === "number" && Number.isFinite(flat)) return flat;
    }
    return null;
  }, [latestSession]);

  /* -------------------------------------------------------------------- */
  /* Save handlers                                                          */
  /* -------------------------------------------------------------------- */

  const saveNotes = useCallback(async () => {
    setSavingNotes(true);
    try {
      const next = await updateUserAdminContext(userId, {
        general_notes: adminNotes,
      });
      setContext(next);
      toast.success("Notes saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }, [userId, adminNotes]);

  /**
   * Persist an admin edit to a bot's interview question text. The PATCH
   * goes to the backend via the BFF route at
   *   PATCH /api/v2/admin/turns/[turnId]/question
   * which proxies to /v2/admin/turns/{turn_id}/question on the backend.
   * The optimistic UI updates the local `interviewTurns` state so the new
   * copy is reflected immediately.
   */
  const saveTurnEdit = useCallback(
    async (idx: number) => {
      const turn = interviewTurns[idx];
      const turnId = turn?.id;
      if (!turnId) {
        toast.error("Cannot edit — turn id missing on payload");
        return;
      }
      const nextText = editingTurnDraft.trim();
      if (!nextText) {
        toast.error("Question cannot be empty");
        return;
      }
      setSavingTurnIdx(idx);
      try {
        const token = await getAuthToken();
        if (!token) {
          toast.error("Not authenticated");
          return;
        }
        const res = await fetch(
          `/api/v2/admin/turns/${encodeURIComponent(turnId)}/question`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ text: nextText }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Save failed (HTTP ${res.status})`);
        }
        // Optimistic local update so the bubble re-renders with the edit.
        setInterviewTurns((prev) =>
          prev.map((t, i) =>
            i === idx
              ? { ...t, question: { ...t.question, text: nextText } }
              : t
          )
        );
        setEditingTurnIdx(null);
        setEditingTurnDraft("");
        toast.success("Message updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save edit");
      } finally {
        setSavingTurnIdx(null);
      }
    },
    [interviewTurns, editingTurnDraft]
  );

  const saveInstructions = useCallback(async () => {
    setSavingInstructions(true);
    try {
      const next = await updateUserAdminContext(userId, {
        custom_instructions: llmInstructions,
      });
      setContext(next);
      toast.success("LLM instructions saved");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to save instructions"
      );
    } finally {
      setSavingInstructions(false);
    }
  }, [userId, llmInstructions]);

  const handleSaveSnippetComment = useCallback(
    async (snippetId: string, comment: string, followUpQuestion: string) => {
      setSavingSnippetId(snippetId);
      try {
        const token = await getAuthToken();
        if (!token) {
          toast.error("Not authenticated");
          return;
        }
        const trimmedComment = comment.trim() ? comment : null;
        const trimmedFollowUp = followUpQuestion.trim()
          ? followUpQuestion
          : null;
        const res = await fetch(
          `/api/v2/admin/snippets/${snippetId}/comment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              admin_comment: trimmedComment,
              follow_up_question: trimmedFollowUp,
              snippet_type:
                snippets.find((s) => s.id === snippetId)?.snippet_type ??
                "unlabeled",
            }),
          }
        );
        if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
        const data = await res.json();
        const updated: AdminSnippet | undefined = data?.snippet;
        if (updated) {
          setSnippets((prev) =>
            prev.map((s) => (s.id === snippetId ? { ...s, ...updated } : s))
          );
        } else {
          // Optimistic patch — backend may not echo the snippet yet.
          setSnippets((prev) =>
            prev.map((s) =>
              s.id === snippetId
                ? {
                    ...s,
                    admin_comment: trimmedComment,
                    follow_up_question: trimmedFollowUp,
                  }
                : s
            )
          );
        }
        toast.success("Snippet saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save snippet");
      } finally {
        setSavingSnippetId(null);
      }
    },
    [snippets]
  );

  const handleSnippetLabel = useCallback(
    (snippetId: string, type: "charisma" | "stress") => {
      // Backend: same /comment endpoint accepts snippet_type. Optimistic update.
      setSnippets((prev) =>
        prev.map((s) =>
          s.id === snippetId ? { ...s, snippet_type: type } : s
        )
      );
    },
    []
  );

  const handleAdjustBounds = useCallback(
    async (snippetId: string, edge: "start" | "end", deltaMs: number) => {
      const target = snippets.find((s) => s.id === snippetId);
      if (!target) return;

      // Compute current boundaries (from snippet fields or derive from offset/duration)
      const currentStartMs = target.start_offset_ms ?? 0;
      const currentEndMs = currentStartMs + (target.duration_ms ?? 0);
      const currentStart = currentStartMs / 1000;
      const currentEnd = currentEndMs / 1000;

      const deltaSec = deltaMs / 1000;
      const newStart = edge === "start" ? Math.max(0, currentStart + deltaSec) : currentStart;
      const newEnd = edge === "end" ? Math.max(newStart + 0.5, currentEnd + deltaSec) : currentEnd;

      try {
        const token = await getAuthToken();
        if (!token) {
          toast.error("Not authenticated");
          return;
        }
        const res = await fetch(
          `/api/v2/admin/snippets/${snippetId}/bounds`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ start_time: newStart, end_time: newEnd }),
          }
        );
        if (!res.ok) throw new Error(`Adjust failed (HTTP ${res.status})`);
        const data = await res.json();
        if (data.snippet) {
          setSnippets((prev) =>
            prev.map((s) => (s.id === snippetId ? { ...s, ...data.snippet } : s))
          );
        }
        toast.success(
          data.metrics_recomputed
            ? "Boundaries adjusted — metrics recomputed"
            : "Boundaries adjusted"
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to adjust bounds");
      }
    },
    [snippets]
  );

  const handleSkipSnippet = useCallback(async (snippetId: string) => {
    const target = snippets.find((s) => s.id === snippetId);
    const newSkipped = !target?.is_skipped;
    // Optimistic update
    setSnippets((prev) =>
      prev.map((s) =>
        s.id === snippetId ? { ...s, is_skipped: newSkipped } : s
      )
    );
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Not authenticated");
        return;
      }
      const res = await fetch(
        `/api/v2/admin/snippets/${snippetId}/skip`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_skipped: newSkipped }),
        }
      );
      if (!res.ok) throw new Error(`Skip failed (HTTP ${res.status})`);
      toast.success(newSkipped ? "Snippet skipped" : "Snippet restored");
    } catch (e) {
      // Revert optimistic
      setSnippets((prev) =>
        prev.map((s) =>
          s.id === snippetId ? { ...s, is_skipped: !newSkipped } : s
        )
      );
      toast.error(e instanceof Error ? e.message : "Failed to skip snippet");
    }
  }, [snippets]);

  const handlePublish = useCallback(async () => {
    if (!latestSession) {
      toast.error("No session available");
      return;
    }

    // The /results page only renders snippets where admin_comment is
    // non-empty (db.py::get_snippets_with_comments_by_session). If no
    // snippet has a comment yet, publishing emails the user a link to
    // a page that will appear empty — almost never what the admin
    // wants. Confirm before continuing.
    const commentedCount = sessionSnippets.reduce(
      (n, s) => (s.admin_comment && s.admin_comment.trim() ? n + 1 : n),
      0
    );
    if (commentedCount === 0) {
      const ok = window.confirm(
        "No snippets have a coach comment yet — the user's /results page " +
          "will appear empty. Publish and send the email anyway?"
      );
      if (!ok) return;
    }

    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Not authenticated");
        return;
      }
      const res = await fetch("/api/v2/internal/publish-session-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: latestSession.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Publish failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      toast.success(`Published${data.email_sent_to ? ` to ${data.email_sent_to}` : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    }
  }, [latestSession, sessionSnippets]);


  /* -------------------------------------------------------------------- */
  /* Render                                                                 */
  /* -------------------------------------------------------------------- */

  const userName = displayName(profile);
  const userEmail = profile?.email ?? context?.user_email ?? "—";

  return (
    <div className="min-h-screen bg-orange-50/40">
      {/* Sticky top nav */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all users
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* User Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={userName} sizePx={56} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {userName}
              </h1>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePublish}
              disabled={!latestSession}
              className="rounded-full px-5"
            >
              Publish Results
            </Button>
            <HeaderMenu
              onArchive={() =>
                toast.info("Archive flow not wired in this PR")
              }
              onDelete={() =>
                toast.info("Delete flow not wired in this PR")
              }
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="sessions">
          <TabsList>
            <TabsTrigger value="sessions">Sessions &amp; Analysis</TabsTrigger>
            <TabsTrigger value="transcript">
              Chat Transcript &amp; Override
            </TabsTrigger>
            <TabsTrigger value="profile">Long-Term Profile</TabsTrigger>
          </TabsList>

          {/* ---------------- TAB 1 — Sessions & Analysis ---------------- */}
          <TabsContent value="sessions" className="space-y-6">
            {/* Session header row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-medium">
                Session Date:{" "}
                <span className="text-muted-foreground">
                  {formatSessionDate(
                    latestSession?.completed_at ?? latestSession?.created_at
                  )}
                </span>
              </p>
              <Badge
                variant={
                  latestSession?.status === "completed" ? "success" : "default"
                }
              >
                {latestSession?.status ?? (loading ? "loading…" : "no session")}
              </Badge>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {sessionMetrics.map((m) => (
                <MetricCard key={m.label} label={m.label} value={m.value} />
              ))}
            </div>

            {/* AI Session Summary Card */}
            <Card className="rounded-2xl border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold">AI Session Summary</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {aiSummary
                      ? aiSummary
                      : "Run “Compute Metrics” to generate the AI summary."}
                  </p>
                  {aiScore != null && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      AI Alignment Score: <span className="font-semibold text-foreground">{Math.round(aiScore)}/100</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {finalKpi == null ? "—" : Math.round(finalKpi * 100)}
                    <span className="text-base font-normal text-muted-foreground">
                      {finalKpi == null ? "" : "%"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    KPI
                  </p>
                </div>
              </div>
            </Card>

            {/* Full Recording — the contiguous session audio. Sits ABOVE
                the per-turn timeline so admins have both: scrub-the-whole-
                thing (this card) AND pinpoint-a-specific-turn (timeline
                below). Spec: bg-muted/30 background, orange play button —
                that's exactly what AudioPlayer renders. */}
            <Card className="rounded-2xl border-border p-5">
              <h3 className="mb-3 text-base font-semibold">
                Full Recording
                {latestSession?.recording_preview?.duration_ms != null
                  ? ` — ${formatRange(0, latestSession.recording_preview.duration_ms).split(" – ")[1]}`
                  : ""}
              </h3>
              <AudioPlayer
                src={recordingUrl}
                duration={
                  latestSession?.recording_preview?.duration_ms != null
                    ? `${(latestSession.recording_preview.duration_ms / 1000).toFixed(0)}s`
                    : undefined
                }
              />
            </Card>

            {/* Conversation Timeline — per-turn audio + transcript. Sits
                immediately below Full Recording (per the merge spec) so
                the two affordances stack naturally. Each turn card uses
                the same rounded-2xl border-border aesthetic as the rest
                of the dashboard. */}
            <section
              aria-label="Conversation timeline"
              className="space-y-4"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-base font-semibold">
                  Conversation Timeline
                </h3>
                <p className="text-xs text-muted-foreground">
                  {interviewTurns.length === 0
                    ? "No turns yet"
                    : `${interviewTurns.length} turn${interviewTurns.length === 1 ? "" : "s"}`}
                </p>
              </div>

              {interviewTurns.length === 0 ? (
                <Card className="rounded-2xl border-dashed border-border p-5 text-sm text-muted-foreground">
                  No interview turns recorded for this session yet. The
                  timeline appears here once the user records their first
                  answer.
                </Card>
              ) : (
                <div className="space-y-3">
                  {interviewTurns.map((turn, idx) => {
                    const turnNumber = turn.turn_number ?? idx + 1;
                    const transcript =
                      turn.answer?.transcript ??
                      turn.answer?.transcript_text ??
                      turn.answer?.transcription ??
                      turn.transcript ??
                      null;
                    const durationLabel =
                      turn.answer?.duration_ms != null
                        ? `${(turn.answer.duration_ms / 1000).toFixed(1)}s`
                        : null;
                    return (
                      <Card
                        key={turn.id ?? `turn-${idx}`}
                        className="rounded-2xl border-border p-4"
                      >
                        {/* Header: turn number + tone + duration */}
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Turn {turnNumber}
                          </span>
                          {turn.question?.tone && (
                            <Badge variant="outline">
                              {turn.question.tone}
                            </Badge>
                          )}
                          {durationLabel && (
                            <span className="text-xs text-muted-foreground">
                              {durationLabel}
                            </span>
                          )}
                        </div>

                        {/* Question that was asked */}
                        {turn.question?.text && (
                          <p className="mb-3 text-sm leading-relaxed text-foreground">
                            <span className="text-muted-foreground">
                              Q:&nbsp;
                            </span>
                            {turn.question.text}
                          </p>
                        )}

                        {/* Per-turn audio player.
                            Uses PlayableAudio so a broken source (e.g. stale
                            R2 URL) surfaces a visible "Audio unavailable"
                            badge instead of a silent 0:00 player. */}
                        {turn.answer?.audio_url ? (
                          <PlayableAudio src={turn.answer.audio_url} />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No audio recorded for this turn.
                          </p>
                        )}

                        {/* Transcript */}
                        <div className="mt-3 rounded-lg bg-muted/40 p-3">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Transcript
                          </p>
                          {transcript ? (
                            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                              {transcript}
                            </p>
                          ) : (
                            <p className="text-xs italic text-muted-foreground">
                              No transcript captured for this turn.
                            </p>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Snippets list — visually nested under the timeline */}
            <div className="pl-6 border-l-2 border-primary/20 space-y-4">
              {sessionSnippets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {loading
                    ? "Loading snippets…"
                    : "No snippets extracted for this session yet."}
                </p>
              ) : (
                sessionSnippets.map((s) => (
                  <SnippetCard
                    key={s.id}
                    snippet={s}
                    saving={savingSnippetId === s.id}
                    onAdjustBounds={handleAdjustBounds}
                    onLabel={handleSnippetLabel}
                    onSaveComment={handleSaveSnippetComment}
                    onSkip={handleSkipSnippet}
                    boundaryDisabled={false}
                    skipDisabled={false}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* ---------------- TAB 2 — Chat Transcript & Override --------- */}
          <TabsContent value="transcript" className="space-y-6">
            <Card className="rounded-2xl border-border p-5">
              <h3 className="mb-1 text-base font-semibold">
                Conversation Transcript
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                The Q&amp;A flow from the user&apos;s most recent interview.
              </p>
              <div className="space-y-3">
                {interviewTurns.length > 0 ? (
                  interviewTurns.map((turn, idx) => {
                    const isEditing = editingTurnIdx === idx;
                    const isSavingThis = savingTurnIdx === idx;
                    const canEdit = !!turn.id;
                    return (
                      <div key={turn.id ?? idx} className="space-y-2">
                        {/* Bot question bubble — admin can edit the text */}
                        {(turn.question?.text || isEditing) && (
                          <div className="group flex items-start gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                              W
                            </div>
                            {isEditing ? (
                              <div className="flex-1 space-y-2">
                                <Textarea
                                  rows={3}
                                  value={editingTurnDraft}
                                  onChange={(e) =>
                                    setEditingTurnDraft(e.target.value)
                                  }
                                  placeholder="Bot question text…"
                                  autoFocus
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={isSavingThis}
                                    onClick={() => void saveTurnEdit(idx)}
                                    className="rounded-full px-4"
                                  >
                                    {isSavingThis ? "Saving…" : "Save"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={isSavingThis}
                                    onClick={() => {
                                      setEditingTurnIdx(null);
                                      setEditingTurnDraft("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex w-full items-start gap-2">
                                <div className="flex-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
                                  <span className="mr-2 text-[10px] font-medium uppercase text-muted-foreground">
                                    {turn.question.tone ?? ""}
                                  </span>
                                  {turn.question.text}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={!canEdit}
                                  title={
                                    canEdit
                                      ? "Edit AI message"
                                      : "Edit unavailable — turn id missing"
                                  }
                                  onClick={() => {
                                    setEditingTurnIdx(idx);
                                    setEditingTurnDraft(turn.question.text ?? "");
                                  }}
                                  className="shrink-0 gap-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {/* User audio bubble — right-aligned, bg-primary
                            per the spec. Mirrors the funnel ChatBubble
                            user variant so admin and end-user see the
                            same visual grammar for "this is the user's
                            voice answer". Audio control + duration sit
                            inside the orange pill — and when the source
                            404s, the bubble flips to an amber "Audio
                            unavailable" badge in the same alignment so
                            broken state is visible instead of silent. */}
                        {turn.answer?.audio_url && (
                          <TranscriptUserAudioBubble
                            src={turn.answer.audio_url}
                            durationMs={turn.answer.duration_ms}
                            startOffsetMs={turn.answer.start_offset_ms ?? 0}
                            turnNumber={turn.turn_number}
                            turnTotal={interviewTurns.filter(t => t.answer?.audio_url).length}
                          />
                        )}
                      </div>
                    );
                  })
                ) : latestSession?.recording_preview?.transcription_preview ? (
                  <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
                    {latestSession.recording_preview.transcription_preview}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No interview turns recorded for this session yet.
                  </p>
                )}
              </div>
            </Card>

            <OverrideCard userId={userId} />
          </TabsContent>

          {/* ---------------- TAB 3 — Long-Term Profile ------------------ */}
          <TabsContent value="profile">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="rounded-2xl border-border p-5">
                <h3 className="text-base font-semibold">Private Admin Notes</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  Internal context — never shown to the user.
                </p>
                <Textarea
                  rows={8}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Notes about this user…"
                />
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 rounded-full px-4"
                  disabled={savingNotes}
                  onClick={() => void saveNotes()}
                >
                  {savingNotes ? "Saving…" : "Save Notes"}
                </Button>
              </Card>

              <Card className="rounded-2xl border-border p-5">
                <h3 className="text-base font-semibold">
                  Global LLM Instructions
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  Persistent rules forwarded to the AI on the next session
                  (e.g. &quot;Don&apos;t ask about X&quot;).
                </p>
                <Textarea
                  rows={8}
                  value={llmInstructions}
                  onChange={(e) => setLlmInstructions(e.target.value)}
                  placeholder="Rules for the AI…"
                />
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 rounded-full px-4"
                  disabled={savingInstructions}
                  onClick={() => void saveInstructions()}
                >
                  {savingInstructions ? "Saving…" : "Save Instructions"}
                </Button>
              </Card>

              <Card className="rounded-2xl border-border p-5">
                <h3 className="text-base font-semibold">Learning Profile</h3>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="default">Stressor</Badge>
                  <span className="text-xs text-muted-foreground">
                    auto-detected
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Override below if the auto-classification is wrong.
                </p>
                <select
                  defaultValue="stressor"
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={async (e) => {
                    const val = e.target.value;
                    try {
                      const token = await getAuthToken();
                      if (!token) {
                        toast.error("Not authenticated");
                        return;
                      }
                      const res = await fetch(
                        `/api/v2/admin/users/${userId}/learning-profile`,
                        {
                          method: "PATCH",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ learning_profile: val }),
                        }
                      );
                      if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
                      toast.success(`Learning profile set to "${val}"`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to save");
                    }
                  }}
                >
                  <option value="stressor">Stressor</option>
                  <option value="racer">Racer</option>
                  <option value="freezer">Freezer</option>
                </select>
                <p className="mt-2 text-xs text-muted-foreground">
                  Affects how the next session is tuned.
                </p>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * TAB 2 — Override input (kept separate to localize its own state)
 * ------------------------------------------------------------------------- */

function OverrideCard({ userId }: { userId: string }) {
  const [draft, setDraft] = useState("");
  const queue = async () => {
    if (!draft.trim()) return;
    try {
      // Stored against the user's custom_instructions for now — backend can
      // promote this to a per-turn override queue when ready.
      await updateUserAdminContext(userId, {
        custom_instructions: draft,
      });
      toast.success("Queued — will be used on the next AI question");
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to queue");
    }
  };
  return (
    <Card className="rounded-2xl border-border p-5">
      <h3 className="text-base font-semibold">Override Next AI Question</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Queue a specific question for the AI to ask next. Persists in the
        user&apos;s LLM instructions until the next session consumes it.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder='e.g. "Ask about their last public-speaking experience"'
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          type="button"
          onClick={() => void queue()}
          disabled={!draft.trim()}
          className="gap-1.5 rounded-full"
        >
          <Send className="h-4 w-4" />
          Queue
        </Button>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
 * Snippet loader — uses the existing v2 admin endpoint.
 * Backend response is normalized to the AdminSnippet shape used above; any
 * extra fields (metrics, is_skipped) are passed through when present.
 * ------------------------------------------------------------------------- */

async function fetchUserSnippets(userId: string): Promise<AdminSnippet[]> {
  const token = await getAuthToken();
  if (!token) return [];
  const res = await fetch(`/api/v2/admin/users/${userId}/snippets?limit=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const arr: unknown[] = Array.isArray(data?.snippets) ? data.snippets : [];
  return arr.map((raw) => raw as AdminSnippet);
}
