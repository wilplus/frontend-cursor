"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Check,
  RefreshCcw,
  RotateCcw,
  SkipForward,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminApi, type StressSnippet } from "@/lib/api/admin-client";

type SourceFilter = "all" | "student" | "internet";
type LabelFilter = "unlabeled" | "labeled" | "all";
type SortOption = "newest" | "oldest";

interface RecentReview {
  snippetId: string;
  source: string;
  label: "Stress" | "No Stress";
}

const REGEN_MAX_SNIPPETS = 8;
const REGEN_CLIP_SECONDS = 5;

/**
 * Format a seconds field with a legacy `_ms` fallback. Backend emits both, but
 * older rows may have `*_sec === 0` with only `*_ms` populated.
 */
function secondsWithMsFallback(seconds: number | null | undefined, ms: number | null | undefined): number {
  if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) return seconds;
  if (typeof ms === "number" && Number.isFinite(ms)) return ms / 1000;
  return 0;
}

function snippetStartSec(s: StressSnippet): number {
  return secondsWithMsFallback(s.start_sec ?? s.startSec, s.start_ms);
}

function snippetEndSec(s: StressSnippet): number {
  return secondsWithMsFallback(s.end_sec ?? s.endSec, s.end_ms);
}

function snippetDurationSec(s: StressSnippet): number {
  return secondsWithMsFallback(s.duration_sec ?? s.durationSec, s.duration_ms);
}

function formatTimingRange(s: StressSnippet): string {
  const start = snippetStartSec(s);
  const end = snippetEndSec(s);
  const duration = snippetDurationSec(s);
  return `${start.toFixed(1)}s – ${end.toFixed(1)}s (${duration.toFixed(1)}s)`;
}

export default function AcousticDojoWorkspace({ showHeader = true }: { showHeader?: boolean }) {
  const [sourceType, setSourceType] = useState<SourceFilter>("student");
  const [labelState, setLabelState] = useState<LabelFilter>("unlabeled");
  const [sort, setSort] = useState<SortOption>("newest");
  const [hideSkipped, setHideSkipped] = useState(true);
  const [recordingIdFilter, setRecordingIdFilter] = useState<string>("");

  const [snippets, setSnippets] = useState<StressSnippet[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenTargetId, setRegenTargetId] = useState("");

  const [autoExtractEnabled, setAutoExtractEnabled] = useState<boolean | null>(null);
  const [autoExtractSaving, setAutoExtractSaving] = useState(false);

  const [labelingId, setLabelingId] = useState<string | null>(null);
  const [notesBySnippetId, setNotesBySnippetId] = useState<Record<string, string>>({});
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSnippets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.listStressSnippets({
        source_type: sourceType,
        label_state: labelState,
        sort,
        exclude_queue_skipped: hideSkipped,
        recording_id: recordingIdFilter.trim() || undefined,
        limit: 50,
        offset: 0,
      });
      const playableSnippets = response.snippets.filter((s) => s.playable && s.audio_url);
      setSnippets(playableSnippets);
      setTotalCount(response.count);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load snippets");
    } finally {
      setLoading(false);
    }
  }, [sourceType, labelState, sort, hideSkipped, recordingIdFilter]);

  useEffect(() => {
    void loadSnippets();
  }, [loadSnippets]);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const res = await adminApi.getStressSnippetSettings();
        if (!cancelled) setAutoExtractEnabled(Boolean(res.auto_extract_enabled));
      } catch (error) {
        if (!cancelled) console.error(error);
      }
    }
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAutoExtract = useCallback(async () => {
    if (autoExtractEnabled == null) return;
    const next = !autoExtractEnabled;
    setAutoExtractSaving(true);
    setAutoExtractEnabled(next); // optimistic
    try {
      const res = await adminApi.updateStressSnippetSettings(next);
      setAutoExtractEnabled(Boolean(res.auto_extract_enabled));
      toast.success(`Auto-extract ${next ? "enabled" : "disabled"}`);
    } catch (error) {
      setAutoExtractEnabled(!next); // roll back
      toast.error(error instanceof Error ? error.message : "Failed to update setting");
    } finally {
      setAutoExtractSaving(false);
    }
  }, [autoExtractEnabled]);

  const onPickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const uploadFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file) return;

      const formData = new FormData();
      formData.set("audio_file", file);
      formData.set("source_kind", "coach_upload");
      formData.set("overall_quality", "good");
      formData.set("confidence_score", "8");
      formData.set("coach_style_score", "8");
      formData.set("rubric_version", "v1");
      formData.set("language_code", "en");

      setUploading(true);
      try {
        const response = await adminApi.uploadExternalRecording(formData);
        const generated = Number(response.generated_snippets_count ?? 0);
        toast.success(
          generated > 0
            ? `Uploaded. Generated ${generated} snippet${generated === 1 ? "" : "s"}.`
            : "Uploaded recording."
        );
        setSourceType("internet");
        await loadSnippets();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed");
      } finally {
        setUploading(false);
        event.target.value = "";
      }
    },
    [loadSnippets]
  );

  const labelSnippet = useCallback(
    async (snippet: StressSnippet, label: "stress" | "no_stress") => {
      setLabelingId(snippet.id);
      // optimistic: remove from current list (it no longer matches `unlabeled`)
      const prevSnippets = snippets;
      setSnippets((prev) => prev.filter((item) => item.id !== snippet.id));
      try {
        const notes = (notesBySnippetId[snippet.id] || "").trim();
        await adminApi.labelStressSnippet(snippet.id, {
          label,
          notes: notes || null,
        });
        const reviewLabel: RecentReview["label"] = label === "stress" ? "Stress" : "No Stress";
        setRecentReviews((prev) =>
          [
            {
              snippetId: snippet.id,
              source: snippet.source_type ?? "unknown",
              label: reviewLabel,
            },
            ...prev,
          ].slice(0, 8)
        );
        toast.success("Label saved");
      } catch (error) {
        setSnippets(prevSnippets); // roll back
        toast.error(error instanceof Error ? error.message : "Failed to save label");
      } finally {
        setLabelingId(null);
      }
    },
    [notesBySnippetId, snippets]
  );

  const undoLabel = useCallback(
    async (snippet: StressSnippet) => {
      setLabelingId(snippet.id);
      const prevSnippets = snippets;
      setSnippets((prev) =>
        prev.map((item) =>
          item.id === snippet.id
            ? { ...item, coach_label: null, coach_label_notes: null }
            : item
        )
      );
      try {
        await adminApi.unlabelStressSnippet(snippet.id);
        toast.success("Label removed");
      } catch (error) {
        setSnippets(prevSnippets);
        toast.error(error instanceof Error ? error.message : "Failed to undo label");
      } finally {
        setLabelingId(null);
      }
    },
    [snippets]
  );

  const toggleSkip = useCallback(
    async (snippet: StressSnippet) => {
      const willSkip = !snippet.queue_skipped;
      setLabelingId(snippet.id);
      const prevSnippets = snippets;
      setSnippets((prev) =>
        prev.map((item) =>
          item.id === snippet.id ? { ...item, queue_skipped: willSkip } : item
        )
      );
      try {
        if (willSkip) {
          await adminApi.queueSkipStressSnippet(snippet.id);
        } else {
          await adminApi.queueUnskipStressSnippet(snippet.id);
        }
        toast.success(willSkip ? "Snippet skipped" : "Snippet restored");
        if (willSkip && hideSkipped) {
          setSnippets((prev) => prev.filter((item) => item.id !== snippet.id));
        }
      } catch (error) {
        setSnippets(prevSnippets);
        toast.error(error instanceof Error ? error.message : "Failed to update skip state");
      } finally {
        setLabelingId(null);
      }
    },
    [snippets, hideSkipped]
  );

  const regenerateForRecording = useCallback(
    async (recordingId: string) => {
      const trimmed = recordingId.trim();
      if (!trimmed) {
        toast.error("Recording ID required");
        return;
      }
      setRegenerating(true);
      try {
        const res = await adminApi.generateStressSnippets(trimmed, {
          max_snippets: REGEN_MAX_SNIPPETS,
          clip_seconds: REGEN_CLIP_SECONDS,
          clear_existing: true,
        });
        const count = Number(res.generated_count ?? res.snippets?.length ?? 0);
        toast.success(
          count > 0
            ? `Regenerated ${count} snippet${count === 1 ? "" : "s"}.`
            : "Regenerated (no snippets produced)."
        );
        setRegenTargetId("");
        await loadSnippets();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Regenerate failed");
      } finally {
        setRegenerating(false);
      }
    },
    [loadSnippets]
  );

  const currentSnippet = useMemo(() => snippets[0] ?? null, [snippets]);

  const emptyStateMessage = useMemo(() => {
    if (loading) return null;
    if (snippets.length > 0) return null;
    if (recordingIdFilter.trim()) {
      return "This recording has no snippets — click Regenerate to produce fresh clips.";
    }
    if (autoExtractEnabled === false && sourceType !== "internet") {
      return "Auto-extract is off — enable it to start seeing student snippets.";
    }
    return "No snippets match this filter.";
  }, [loading, snippets.length, recordingIdFilter, autoExtractEnabled, sourceType]);

  return (
    <div className="space-y-5 animate-fade-in-short">
      {showHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Voice Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Label stress/no stress for ≤5s student and uploaded clips.
            </p>
          </div>
          <AutoExtractToggle
            enabled={autoExtractEnabled}
            saving={autoExtractSaving}
            onToggle={toggleAutoExtract}
          />
        </div>
      ) : (
        <div className="flex justify-end">
          <AutoExtractToggle
            enabled={autoExtractEnabled}
            saving={autoExtractSaving}
            onToggle={toggleAutoExtract}
          />
        </div>
      )}

      <div className="mx-auto max-w-[880px] space-y-4">
        {/* Filters row */}
        <Card className="border-border/80 bg-card/95 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <FilterPillGroup
              label="Source"
              value={sourceType}
              onChange={(next) => setSourceType(next)}
              options={[
                { value: "all", label: "All" },
                { value: "student", label: "Student" },
                { value: "internet", label: "Internet" },
              ]}
            />
            <FilterPillGroup
              label="Label"
              value={labelState}
              onChange={(next) => setLabelState(next)}
              options={[
                { value: "unlabeled", label: "Unlabeled" },
                { value: "labeled", label: "Labeled" },
                { value: "all", label: "All" },
              ]}
            />
            <FilterPillGroup
              label="Sort"
              value={sort}
              onChange={(next) => setSort(next)}
              options={[
                { value: "newest", label: "Newest" },
                { value: "oldest", label: "Oldest" },
              ]}
            />
            <label className="ml-auto inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={hideSkipped}
                onChange={(e) => setHideSkipped(e.target.checked)}
              />
              Hide skipped
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadSnippets()} disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={onPickUpload} disabled={uploading}>
              <UploadCloud className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload recording"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={uploadFile}
              className="hidden"
            />
            <div className="ml-auto flex items-center gap-2">
              <input
                type="text"
                placeholder="Recording ID"
                value={regenTargetId}
                onChange={(e) => setRegenTargetId(e.target.value)}
                className="h-9 w-[220px] rounded-md border border-input bg-background px-3 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void regenerateForRecording(regenTargetId)}
                disabled={regenerating || !regenTargetId.trim()}
              >
                <Wand2 className="mr-2 h-4 w-4" />
                {regenerating ? "Regenerating..." : "Regenerate"}
              </Button>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing <span className="font-medium text-foreground">{snippets.length}</span> of{" "}
            <span className="font-medium text-foreground">{totalCount}</span>
          </span>
          {recordingIdFilter.trim() ? (
            <button
              type="button"
              className="text-amber-600 hover:text-amber-700"
              onClick={() => setRecordingIdFilter("")}
            >
              Clear recording filter
            </button>
          ) : null}
        </div>

        {/* Focus card = first row */}
        <Card className="space-y-5 border-border/80 bg-card/95 p-0">
          {loading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading snippets...</p>
          ) : currentSnippet == null ? (
            <div className="m-5 rounded-md border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">{emptyStateMessage}</p>
              {recordingIdFilter.trim() ? (
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={() => void regenerateForRecording(recordingIdFilter)}
                  disabled={regenerating}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  {regenerating ? "Regenerating..." : "Regenerate for this recording"}
                </Button>
              ) : null}
            </div>
          ) : (
            <SnippetFocusCard
              snippet={currentSnippet}
              labeling={labelingId === currentSnippet.id}
              notes={notesBySnippetId[currentSnippet.id] ?? ""}
              onNotesChange={(value) =>
                setNotesBySnippetId((prev) => ({ ...prev, [currentSnippet.id]: value }))
              }
              onLabel={(label) => void labelSnippet(currentSnippet, label)}
              onUndo={() => void undoLabel(currentSnippet)}
              onSkipToggle={() => void toggleSkip(currentSnippet)}
              onRegenerate={() => void regenerateForRecording(currentSnippet.recording_id)}
              regenerating={regenerating}
            />
          )}
        </Card>

        {/* Queue list */}
        {snippets.length > 1 ? (
          <Card className="border-border/80 bg-card/95 p-0">
            <div className="border-b px-5 py-3">
              <h3 className="text-base font-semibold">Queue</h3>
            </div>
            <div className="divide-y">
              {snippets.slice(1).map((snippet) => (
                <SnippetRow
                  key={snippet.id}
                  snippet={snippet}
                  labeling={labelingId === snippet.id}
                  notes={notesBySnippetId[snippet.id] ?? ""}
                  onNotesChange={(value) =>
                    setNotesBySnippetId((prev) => ({ ...prev, [snippet.id]: value }))
                  }
                  onLabel={(label) => void labelSnippet(snippet, label)}
                  onUndo={() => void undoLabel(snippet)}
                  onSkipToggle={() => void toggleSkip(snippet)}
                  onRegenerate={() => void regenerateForRecording(snippet.recording_id)}
                  regenerating={regenerating}
                />
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="border-border/80 bg-card/95 p-0">
          <div className="border-b px-5 py-4">
            <h3 className="text-base font-semibold">Recent reviews</h3>
          </div>
          <div className="space-y-2 px-5 py-4">
            {recentReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews in this session yet.</p>
            ) : (
              recentReviews.map((item) => (
                <div
                  key={`${item.snippetId}-${item.label}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span className="text-base">{item.label}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{item.source}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function AutoExtractToggle({
  enabled,
  saving,
  onToggle,
}: {
  enabled: boolean | null;
  saving: boolean;
  onToggle: () => void;
}) {
  const label = enabled == null ? "…" : enabled ? "On" : "Off";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving || enabled == null}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
        enabled ? "border-emerald-500/50 bg-emerald-50 text-emerald-700" : "border-border bg-card text-muted-foreground"
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wide">Auto-extract</span>
      <span className="font-semibold">{label}</span>
    </button>
  );
}

function FilterPillGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`rounded-md px-3 py-1 text-sm ${
              value === opt.value ? "bg-background text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SnippetCardProps {
  snippet: StressSnippet;
  labeling: boolean;
  notes: string;
  onNotesChange: (value: string) => void;
  onLabel: (label: "stress" | "no_stress") => void;
  onUndo: () => void;
  onSkipToggle: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}

function SnippetAudio({
  snippet,
  onError,
  onLoadStart,
}: {
  snippet: StressSnippet;
  onError?: () => void;
  onLoadStart?: () => void;
}) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  // Fetch fresh signed URL from the backend endpoint.
  // The <audio> element handles validation/loading in no-cors mode.
  useEffect(() => {
    if (!snippet.audio_url) {
      setPlaybackUrl(null);
      return;
    }

    let cancelled = false;
    const fetchFreshUrl = async () => {
      try {
        // Fetch fresh signed URL from the dedicated endpoint
        const { playback_url: freshUrl } = await adminApi.getStressSnippetPlaybackUrl(snippet.id);

        if (cancelled) return;

        if (freshUrl) {
          setPlaybackUrl(freshUrl);
        } else {
          // Fallback to original URL if endpoint returns empty
          console.warn(`[SnippetAudio] Fresh URL endpoint returned empty for snippet ${snippet.id}, using original`);
          setPlaybackUrl(snippet.audio_url);
        }
      } catch (err) {
        if (cancelled) return;

        // Fallback to original URL if endpoint fetch fails (network error, 404, etc.)
        console.warn(`[SnippetAudio] Failed to fetch fresh URL for snippet ${snippet.id}, falling back to original`, err);
        setPlaybackUrl(snippet.audio_url);
      }
    };

    void fetchFreshUrl();
    return () => {
      cancelled = true;
    };
  }, [snippet.id, snippet.audio_url]);

  // NEVER fall back to the parent recording's audio — that's the 5-min source.
  // Only play `audio_url`, which the backend guarantees is a signed URL to the
  // per-snippet ≤5s mp3 at `stress_snippets/<recording_id>/<snippet_id>.mp3`.
  if (!snippet.playable || !playbackUrl) return null;

  return (
    <audio
      key={`${snippet.id}:${playbackUrl}`}
      controls
      preload="none"
      className="w-full"
      src={playbackUrl}
      onError={() => {
        console.warn(`[SnippetAudio] Failed to load audio for snippet ${snippet.id}`, {
          audio_url: playbackUrl?.slice(0, 50) + "...",
        });
        onError?.();
      }}
      onLoadStart={() => {
        onLoadStart?.();
      }}
    />
  );
}

function SnippetFocusCard({
  snippet,
  labeling,
  notes,
  onNotesChange,
  onLabel,
  onUndo,
  onSkipToggle,
  onRegenerate,
  regenerating,
}: SnippetCardProps) {
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const canPlay = snippet.playable && !!snippet.audio_url;

  const handleAudioError = useCallback(() => {
    setAudioLoading(false);
    setAudioError("Failed to play audio. The file may be corrupted, unavailable, or the link has expired.");
    toast.error("Failed to load audio");
  }, []);

  const handleAudioLoadStart = useCallback(() => {
    setAudioLoading(true);
    setAudioError(null);
  }, []);

  return (
    <>
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Stress Label</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Scenario: <span className="font-medium text-foreground">{snippet.scenario}</span>
            {snippet.queue_skipped ? (
              <span className="ml-2 rounded bg-zinc-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-700">
                skipped
              </span>
            ) : null}
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          {snippet.source_type} · {formatTimingRange(snippet)}
        </span>
      </div>

      <div className="space-y-5 px-5 pb-5">
        <div className="rounded-xl border bg-muted/20 p-5">
          {canPlay ? (
            <>
              <SnippetAudio
                snippet={snippet}
                onError={handleAudioError}
                onLoadStart={handleAudioLoadStart}
              />
              {audioLoading && (
                <p className="mt-2 text-sm text-muted-foreground">Loading audio…</p>
              )}
              {audioError && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                  <p className="text-sm text-destructive">{audioError}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Try clicking <strong>Regenerate</strong> to produce a fresh clip.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">
                Clip unavailable — the mp3 is missing or hasn&apos;t been produced yet.
              </p>
              <Button size="sm" variant="outline" onClick={onRegenerate} disabled={regenerating}>
                <Wand2 className="mr-2 h-4 w-4" />
                {regenerating ? "Regenerating..." : "Regenerate"}
              </Button>
            </div>
          )}
          {snippet.transcript_excerpt ? (
            <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
              {snippet.transcript_excerpt}
            </p>
          ) : null}
          <textarea
            rows={2}
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Optional notes"
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <p className="text-center text-2xl font-semibold">Is this snippet stress or no stress?</p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            className="h-14 min-w-[140px] text-xl bg-emerald-600 text-white shadow-md hover:bg-emerald-700 focus-visible:ring-emerald-500"
            onClick={() => onLabel("no_stress")}
            disabled={labeling}
          >
            <X className="mr-2 h-4 w-4" />
            No Stress
          </Button>
          <Button
            className="h-14 min-w-[140px] text-xl bg-red-600 text-white shadow-md hover:bg-red-700 focus-visible:ring-red-500"
            onClick={() => onLabel("stress")}
            disabled={labeling}
          >
            <Check className="mr-2 h-4 w-4" />
            Stress
          </Button>
          {snippet.coach_label ? (
            <Button variant="outline" size="sm" onClick={onUndo} disabled={labeling}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Undo
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onSkipToggle} disabled={labeling}>
            <SkipForward className="mr-2 h-4 w-4" />
            {snippet.queue_skipped ? "Unskip" : "Skip"}
          </Button>
        </div>
      </div>
    </>
  );
}

function SnippetRow({
  snippet,
  labeling,
  notes,
  onNotesChange,
  onLabel,
  onUndo,
  onSkipToggle,
  onRegenerate,
  regenerating,
}: SnippetCardProps) {
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const canPlay = snippet.playable && !!snippet.audio_url;

  const handleAudioError = useCallback(() => {
    setAudioLoading(false);
    setAudioError("Failed to load audio");
    toast.error("Failed to load audio");
  }, []);

  const handleAudioLoadStart = useCallback(() => {
    setAudioLoading(true);
    setAudioError(null);
  }, []);

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
            {snippet.source_type}
          </span>
          <span>{formatTimingRange(snippet)}</span>
          <span className="text-zinc-400">·</span>
          <span>{snippet.scenario}</span>
          {snippet.coach_label ? (
            <span
              className={`rounded px-2 py-0.5 font-semibold ${
                snippet.coach_label === "stress"
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {snippet.coach_label === "stress" ? "Stress" : "No stress"}
            </span>
          ) : null}
          {snippet.queue_skipped ? (
            <span className="rounded bg-zinc-200 px-2 py-0.5 uppercase tracking-wide text-zinc-700">
              skipped
            </span>
          ) : null}
        </span>
      </div>
      <div className="rounded-lg border bg-muted/10 p-3">
        {canPlay ? (
          <>
            <SnippetAudio
              snippet={snippet}
              onError={handleAudioError}
              onLoadStart={handleAudioLoadStart}
            />
            {audioError && (
              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5">
                <p className="text-xs text-destructive">{audioError}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try <strong>Regenerate</strong> to produce a fresh clip.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">Clip unavailable — regenerate required.</p>
            <Button size="sm" variant="outline" onClick={onRegenerate} disabled={regenerating}>
              <Wand2 className="mr-2 h-4 w-4" />
              {regenerating ? "Regenerating..." : "Regenerate"}
            </Button>
          </div>
        )}
        {snippet.transcript_excerpt ? (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {snippet.transcript_excerpt}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="bg-red-600 text-white hover:bg-red-700"
          onClick={() => onLabel("stress")}
          disabled={labeling}
        >
          Stress
        </Button>
        <Button
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => onLabel("no_stress")}
          disabled={labeling}
        >
          No stress
        </Button>
        {snippet.coach_label ? (
          <Button variant="outline" size="sm" onClick={onUndo} disabled={labeling}>
            Undo
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onSkipToggle} disabled={labeling}>
          {snippet.queue_skipped ? "Unskip" : "Skip"}
        </Button>
        <input
          type="text"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Notes (optional)"
          className="ml-auto h-9 w-full max-w-[240px] rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
    </div>
  );
}
