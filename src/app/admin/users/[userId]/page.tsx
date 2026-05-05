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
  Minus,
  MoreVertical,
  Plus,
  Send,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  audio_segment_path?: string;
  snippet_type?: string;
  admin_comment?: string | null;
  // Spec fields the backend may not yet supply — surfaced where present.
  is_skipped?: boolean | null;
  metrics?: {
    wpm?: number | null;
    pitch?: string | null;
    fillers?: number | null;
    pause_ms?: number | null;
    dynamic_db?: number | null;
    energy_ratio?: number | null;
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
 */
function AudioPlayer({ src, duration, label }: AudioPlayerProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      {label && (
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {label}
        </p>
      )}
      {src ? (
        <audio
          controls
          src={src}
          controlsList="nodownload"
          className="w-full"
        />
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
  onSaveComment: (snippetId: string, comment: string) => Promise<void>;
  onSkip: (snippetId: string) => void;
  saving?: boolean;
  /** Visual hint: backend endpoints for some controls aren't wired yet. */
  boundaryDisabled?: boolean;
  skipDisabled?: boolean;
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
  const [activeLabel, setActiveLabel] = useState<"charisma" | "stress" | null>(
    snippet.snippet_type === "charisma" || snippet.snippet_type === "stress"
      ? snippet.snippet_type
      : null
  );

  const isSkipped = !!snippet.is_skipped;

  return (
    <Card
      className={`rounded-2xl border-border p-4 transition-opacity ${
        isSkipped ? "opacity-50" : ""
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Snippet {formatRange(snippet.start_offset_ms, snippet.duration_ms)}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {snippet.metrics?.wpm != null && (
            <Badge variant="outline">WPM: {snippet.metrics.wpm}</Badge>
          )}
          {snippet.metrics?.pitch && (
            <Badge variant="outline">Pitch: {snippet.metrics.pitch}</Badge>
          )}
          {typeof snippet.metrics?.fillers === "number" && (
            <Badge variant="outline">Fillers: {snippet.metrics.fillers}</Badge>
          )}
        </div>
      </div>

      {/* Mini audio player */}
      <div className="mb-3">
        <AudioPlayer
          src={snippet.audio_segment_path}
          duration={`${(snippet.duration_ms / 1000).toFixed(1)}s`}
        />
      </div>

      {/* Boundary controls */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={boundaryDisabled}
          onClick={() => onAdjustBounds(snippet.id, "start", -2000)}
        >
          <Minus className="mr-1 h-3 w-3" /> 2s Start
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={boundaryDisabled}
          onClick={() => onAdjustBounds(snippet.id, "start", 2000)}
        >
          <Plus className="mr-1 h-3 w-3" /> 2s Start
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={boundaryDisabled}
          onClick={() => onAdjustBounds(snippet.id, "end", -2000)}
        >
          <Minus className="mr-1 h-3 w-3" /> 2s End
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={boundaryDisabled}
          onClick={() => onAdjustBounds(snippet.id, "end", 2000)}
        >
          <Plus className="mr-1 h-3 w-3" /> 2s End
        </Button>
      </div>

      {/* Quick label buttons */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setActiveLabel("charisma");
            onLabel(snippet.id, "charisma");
          }}
          className={`gap-1.5 rounded-full ${
            activeLabel === "charisma"
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20"
          }`}
        >
          <Flame className="h-3.5 w-3.5" /> Charisma
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setActiveLabel("stress");
            onLabel(snippet.id, "stress");
          }}
          className={`gap-1.5 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 ${
            activeLabel === "stress" ? "bg-destructive/10" : ""
          }`}
        >
          <Droplet className="h-3.5 w-3.5" /> Stress
        </Button>
      </div>

      {/* Admin comment */}
      <Textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Charisma / stress analysis the user will see…"
        className="mb-3"
      />

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => void onSaveComment(snippet.id, comment)}
          className="rounded-full px-4"
        >
          {saving ? "Saving…" : "Save Snippet"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={skipDisabled}
          onClick={() => onSkip(snippet.id)}
          className="gap-1.5 text-muted-foreground"
        >
          <EyeOff className="h-3.5 w-3.5" />
          {isSkipped ? "Skipped" : "Skip Snippet"}
        </Button>
      </div>
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
    return snippets.filter((s) => s.session_id === latestSession.id);
  }, [snippets, latestSession]);

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
    async (snippetId: string, comment: string) => {
      setSavingSnippetId(snippetId);
      try {
        const token = await getAuthToken();
        if (!token) {
          toast.error("Not authenticated");
          return;
        }
        const res = await fetch(
          `/api/v2/admin/snippets/${snippetId}/comment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              admin_comment: comment.trim() ? comment : null,
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
          // Optimistic patch.
          setSnippets((prev) =>
            prev.map((s) =>
              s.id === snippetId ? { ...s, admin_comment: comment } : s
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

  const handleAdjustBounds = useCallback(() => {
    // TODO(backend): PATCH /api/v2/admin/snippets/[id]/bounds. Disabled for now.
    toast.info("Boundary adjustment endpoint not yet wired on backend");
  }, []);

  const handleSkipSnippet = useCallback((snippetId: string) => {
    // TODO(backend): PATCH /api/v2/admin/snippets/[id]/skip { is_skipped: true }.
    setSnippets((prev) =>
      prev.map((s) =>
        s.id === snippetId ? { ...s, is_skipped: !s.is_skipped } : s
      )
    );
    toast.info("Skip flag toggled locally — backend endpoint not yet wired");
  }, []);

  const handlePublish = useCallback(async () => {
    if (!latestSession) {
      toast.error("No session available");
      return;
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
  }, [latestSession]);

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
                    {/* TODO(backend): expose ai_summary + ai_score on session. */}
                    Auto-generated summary will appear here once the backend
                    exposes <code className="font-mono">ai_summary</code>.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {typeof latestSession?.score === "number"
                      ? latestSession.score.toFixed(1)
                      : "—"}
                    <span className="text-base font-normal text-muted-foreground">
                      /10
                    </span>
                  </p>
                </div>
              </div>
            </Card>

            {/* Full Recording */}
            <Card className="rounded-2xl border-border p-5">
              <h3 className="mb-3 text-base font-semibold">
                Full Recording
                {latestSession?.recording_preview?.duration_ms != null
                  ? ` — ${formatRange(0, latestSession.recording_preview.duration_ms).split(" – ")[1]}`
                  : ""}
              </h3>
              {/* The session row carries `recording_id` but no playback URL —
                  fetched on demand if you wire `getRecordingPlaybackUrl`. */}
              <AudioPlayer
                src={null}
                duration={
                  latestSession?.recording_preview?.duration_ms != null
                    ? `${(latestSession.recording_preview.duration_ms / 1000).toFixed(0)}s`
                    : undefined
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Playback URL is fetched lazily; wire{" "}
                <code className="font-mono">
                  adminApi.getRecordingPlaybackUrl(recording_id)
                </code>{" "}
                to populate.
              </p>
            </Card>

            {/* Snippets list — visually nested under the recording */}
            <div className="space-y-4 border-l-2 border-border pl-4">
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
                    boundaryDisabled
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
              {/* TODO(backend): expose interview turns (question text + audio
                  ref) on the session. Until then we surface the report
                  transcript text if available. */}
              <div className="space-y-3">
                {latestSession?.recording_preview?.transcription_preview ? (
                  <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
                    {latestSession.recording_preview.transcription_preview}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Transcript will appear once the backend exposes structured
                    interview turns.
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
                  onChange={() =>
                    toast.info(
                      "Learning-profile override endpoint not yet wired"
                    )
                  }
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
