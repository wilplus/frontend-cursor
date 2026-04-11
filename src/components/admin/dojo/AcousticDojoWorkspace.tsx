"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Check, RefreshCcw, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminApi, type StressSnippet } from "@/lib/api/admin-client";

interface RecentReview {
  snippetId: string;
  source: string;
  label: "Stress" | "No Stress";
}

function fmtMs(ms?: number | null): string {
  const n = Number(ms || 0);
  return `${(n / 1000).toFixed(1)}s`;
}

function snippetRecordingId(s: StressSnippet): string | null {
  const id = s.recording_id ?? (s as { recordingId?: string }).recordingId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function snippetInlineAudioUrl(s: StressSnippet): string | null {
  const url = s.audio_url ?? (s as { audioUrl?: string }).audioUrl;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

function withMediaFragment(url: string, startMs: number, endMs: number): string {
  if (!url || endMs <= startMs) return url;
  const base = url.includes("#") ? url.split("#")[0]! : url;
  return `${base}#t=${startMs / 1000},${endMs / 1000}`;
}

export default function AcousticDojoWorkspace({ showHeader = true }: { showHeader?: boolean }) {
  const [sourceType, setSourceType] = useState<"student" | "internet">("student");
  const [snippets, setSnippets] = useState<StressSnippet[]>([]);
  const [uploading, setUploading] = useState(false);
  const [labelingId, setLabelingId] = useState<string | null>(null);
  const [notesBySnippetId, setNotesBySnippetId] = useState<Record<string, string>>({});
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSnippets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.listStressSnippets({
        source_type: sourceType,
        label_state: "unlabeled",
        limit: 40,
        offset: 0,
      });
      setSnippets(response.snippets ?? []);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load snippets");
    } finally {
      setLoading(false);
    }
  }, [sourceType]);

  useEffect(() => {
    void loadSnippets();
  }, [loadSnippets]);

  const unlabeledCount = useMemo(() => snippets.filter((item) => !item.coach_label).length, [snippets]);

  const onPickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const uploadFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
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
  }, [loadSnippets]);

  const labelSnippet = useCallback(async (snippet: StressSnippet, label: "stress" | "no_stress") => {
    setLabelingId(snippet.id);
    try {
      const notes = (notesBySnippetId[snippet.id] || "").trim();
      await adminApi.labelStressSnippet(snippet.id, {
        label,
        notes: notes || null,
      });
      const reviewLabel: RecentReview["label"] = label === "stress" ? "Stress" : "No Stress";
      setRecentReviews((prev) => [
        {
          snippetId: snippet.id,
          source: snippet.source_type ?? "unknown",
          label: reviewLabel,
        },
        ...prev,
      ].slice(0, 8));
      setSnippets((prev) => prev.filter((item) => item.id !== snippet.id));
      toast.success("Label saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save label");
    } finally {
      setLabelingId(null);
    }
  }, [notesBySnippetId]);

  const currentSnippet = useMemo(() => snippets[0] ?? null, [snippets]);
  const startMs = currentSnippet?.snippet_start_ms ?? 0;
  const endMs =
    currentSnippet?.snippet_end_ms ??
    (currentSnippet?.snippet_duration_ms != null
      ? startMs + Number(currentSnippet.snippet_duration_ms)
      : startMs);

  useEffect(() => {
    if (!currentSnippet) {
      setPlaybackUrl(null);
      setPlaybackLoading(false);
      return;
    }
    setPlaybackUrl(null);
    setPlaybackLoading(true);
    const recId = snippetRecordingId(currentSnippet);
    const inline = snippetInlineAudioUrl(currentSnippet);
    let cancelled = false;

    async function resolve() {
      try {
        if (recId) {
          const { audio_url: signed } = await adminApi.getRecordingPlaybackUrl(recId);
          if (!cancelled && typeof signed === "string" && signed.trim()) {
            setPlaybackUrl(withMediaFragment(signed.trim(), startMs, endMs));
            return;
          }
        }
        if (!cancelled && inline) {
          setPlaybackUrl(withMediaFragment(inline, startMs, endMs));
        } else if (!cancelled) {
          setPlaybackUrl(null);
        }
      } catch {
        if (!cancelled) {
          setPlaybackUrl(inline ? withMediaFragment(inline, startMs, endMs) : null);
        }
      } finally {
        if (!cancelled) setPlaybackLoading(false);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [currentSnippet, startMs, endMs]);

  return (
    <div className="space-y-5 animate-fade-in-short">
      {showHeader ? (
        <div>
          <h1 className="text-2xl font-semibold">Voice Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Label stress/no stress for student clips and uploaded recordings.
          </p>
        </div>
      ) : null}

      <div className="mx-auto max-w-[760px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm ${sourceType === "student" ? "bg-background text-foreground" : "text-muted-foreground"}`}
              onClick={() => setSourceType("student")}
            >
              Student recordings
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm ${sourceType === "internet" ? "bg-background text-foreground" : "text-muted-foreground"}`}
              onClick={() => setSourceType("internet")}
            >
              Uploaded recordings
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadSnippets()} disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={onPickUpload} disabled={uploading}>
              <UploadCloud className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={uploadFile}
              className="hidden"
            />
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Unlabeled in this source: <span className="font-medium text-foreground">{unlabeledCount}</span>
        </div>

        <Card className="space-y-5 border-border/80 bg-card/95 p-0">
          {loading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading snippets...</p>
          ) : currentSnippet == null ? (
            <p className="rounded-md border border-dashed m-5 p-4 text-sm text-muted-foreground">
              No clips available right now.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h2 className="text-3xl font-semibold tracking-tight">Stress Label</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  {currentSnippet.source_type ?? "unknown"} · {fmtMs(startMs)} - {fmtMs(endMs)}
                </span>
              </div>

              <div className="space-y-5 px-5 pb-5">
                <div className="rounded-xl border bg-muted/20 p-5">
                  {playbackLoading ? (
                    <p className="text-sm text-muted-foreground">Loading audio…</p>
                  ) : playbackUrl ? (
                    <audio
                      key={`${currentSnippet.id}-${playbackUrl}`}
                      controls
                      preload="metadata"
                      className="w-full"
                      src={playbackUrl}
                      onError={() =>
                        toast.error("Could not load audio. Try refresh or check the recording on the backend.")
                      }
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No audio URL available for this snippet.</p>
                  )}
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                    {currentSnippet.transcript_text || currentSnippet.transcript || "No transcript available"}
                  </p>
                  <textarea
                    rows={2}
                    value={notesBySnippetId[currentSnippet.id] ?? ""}
                    onChange={(event) =>
                      setNotesBySnippetId((prev) => ({ ...prev, [currentSnippet.id]: event.target.value }))
                    }
                    placeholder="Optional notes"
                    className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <p className="text-center text-2xl font-semibold">
                  Is this snippet stress or no stress?
                </p>

                <div className="flex justify-center gap-3">
                  <Button
                    className="h-14 min-w-[140px] text-xl bg-emerald-600 text-white shadow-md hover:bg-emerald-700 focus-visible:ring-emerald-500"
                    onClick={() => void labelSnippet(currentSnippet, "no_stress")}
                    disabled={labelingId === currentSnippet.id}
                  >
                    <X className="mr-2 h-4 w-4" />
                    No Stress
                  </Button>
                  <Button
                    className="h-14 min-w-[140px] text-xl bg-red-600 text-white shadow-md hover:bg-red-700 focus-visible:ring-red-500"
                    onClick={() => void labelSnippet(currentSnippet, "stress")}
                    disabled={labelingId === currentSnippet.id}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Stress
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card className="border-border/80 bg-card/95 p-0">
          <div className="border-b px-5 py-4">
            <h3 className="text-2xl font-semibold">Recent Reviews</h3>
          </div>
          <div className="space-y-2 px-5 py-4">
            {recentReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews in this session yet.</p>
            ) : (
              recentReviews.map((item) => (
                <div key={`${item.snippetId}-${item.label}`} className="flex items-center justify-between rounded-lg border px-3 py-2">
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
