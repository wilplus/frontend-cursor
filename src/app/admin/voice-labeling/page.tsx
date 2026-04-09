"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import ExternalRecordingUploadCard from "@/components/admin/ExternalRecordingUploadCard";
import SectionCard from "@/components/admin/SectionCard";
import {
  type AdminApiError,
  adminApi,
  type StressSnippet,
  type StressSnippetSettings,
} from "@/lib/api/admin-client";

function fmtMs(ms?: number | null) {
  const n = Number(ms || 0);
  return `${(n / 1000).toFixed(1)}s`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as AdminApiError | undefined;
  const base = apiError?.message || fallback;
  if (apiError?.status === 401) return "Unauthorized. Please sign in again.";
  if (apiError?.status === 403) return "Forbidden. Admin access is required.";
  return base;
}

export default function VoiceLabelingPage() {
  const [settings, setSettings] = useState<StressSnippetSettings | null>(null);
  const [snippets, setSnippets] = useState<StressSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [labelingId, setLabelingId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState("");
  const [generateBusy, setGenerateBusy] = useState(false);
  const [labelState, setLabelState] = useState<"all" | "labeled" | "unlabeled">("unlabeled");
  const [sourceType, setSourceType] = useState<"all" | "student" | "internet">("student");
  const [notesBySnippetId, setNotesBySnippetId] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, listRes] = await Promise.all([
        adminApi.getStressSnippetSettings(),
        adminApi.listStressSnippets({
          source_type: sourceType,
          label_state: labelState,
          limit: 80,
          offset: 0,
        }),
      ]);
      setSettings(settingsRes);
      setSnippets(listRes.snippets || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to load stress snippets"));
    } finally {
      setLoading(false);
    }
  }, [labelState, sourceType]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlabeledCount = useMemo(
    () => snippets.filter((snippet) => !snippet.coach_label).length,
    [snippets]
  );

  async function toggleAutoExtract(nextValue: boolean) {
    if (!settings) return;
    setSavingSwitch(true);
    try {
      const res = await adminApi.updateStressSnippetSettings(nextValue);
      setSettings(res.settings);
      toast.success(nextValue ? "Auto-extract enabled" : "Auto-extract disabled");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to update setting"));
    } finally {
      setSavingSwitch(false);
    }
  }

  async function runGenerate() {
    const rid = recordingId.trim();
    if (!rid) {
      toast.error("Paste a recording ID first");
      return;
    }
    setGenerateBusy(true);
    try {
      const out = await adminApi.generateStressSnippets(rid, {
        max_snippets: 8,
        clip_seconds: 10,
        clear_existing: true,
      });
      toast.success(`Generated ${out.generated_count} snippet(s)`);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Snippet generation failed"));
    } finally {
      setGenerateBusy(false);
    }
  }

  async function setLabel(snippet: StressSnippet, label: "stress" | "no_stress") {
    setLabelingId(snippet.id);
    try {
      const notes = (notesBySnippetId[snippet.id] || "").trim();
      await adminApi.labelStressSnippet(snippet.id, { label, notes: notes || null });
      setSnippets((prev) =>
        prev.map((item) =>
          item.id === snippet.id
            ? { ...item, coach_label: label, coach_label_notes: notes || null }
            : item
        )
      );
      toast.success("Label saved");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to save label"));
    } finally {
      setLabelingId(null);
    }
  }

  async function handleUploaded(newRecordingId: string) {
    setRecordingId(newRecordingId);
    await load();
  }

  return (
    <div className="space-y-4">
      <ExternalRecordingUploadCard onUploaded={(newRecordingId) => void handleUploaded(newRecordingId)} />

      <SectionCard
        title="Stress Snippet Controls"
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Auto extract from student uploads</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When on, snippets are generated automatically after recording-1 processing.
            </p>
            <button
              type="button"
              disabled={!settings || savingSwitch}
              onClick={() => void toggleAutoExtract(!(settings?.auto_extract_enabled ?? true))}
              className="mt-3 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
            >
              {savingSwitch
                ? "Saving..."
                : settings?.auto_extract_enabled
                  ? "ON (click to disable)"
                  : "OFF (click to enable)"}
            </button>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Generate now for one recording</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use right after upload if you want snippets immediately for labeling.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Paste recording ID"
                value={recordingId}
                onChange={(event) => setRecordingId(event.target.value)}
              />
              <button
                type="button"
                onClick={() => void runGenerate()}
                disabled={generateBusy}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
              >
                <WandSparkles className="h-4 w-4" />
                {generateBusy ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Stress Snippets Queue">
        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Source</span>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={sourceType}
              onChange={(event) =>
                setSourceType(event.target.value as "all" | "student" | "internet")
              }
            >
              <option value="student">Student</option>
              <option value="internet">Internet</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Label state</span>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={labelState}
              onChange={(event) =>
                setLabelState(event.target.value as "all" | "labeled" | "unlabeled")
              }
            >
              <option value="unlabeled">Unlabeled</option>
              <option value="labeled">Labeled</option>
              <option value="all">All</option>
            </select>
          </label>
          <div className="flex items-end">
            <div className="rounded-md border border-border px-3 py-2 text-sm">
              Loaded: <span className="font-medium">{snippets.length}</span>
            </div>
          </div>
          <div className="flex items-end">
            <div className="rounded-md border border-border px-3 py-2 text-sm">
              Unlabeled in view: <span className="font-medium">{unlabeledCount}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading snippets...</p>
        ) : snippets.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No snippets for this filter yet.</p>
        ) : (
          <div className="space-y-3">
            {snippets.map((snippet) => {
              const startMs = snippet.snippet_start_ms ?? 0;
              const endMs =
                snippet.snippet_end_ms ??
                (snippet.snippet_duration_ms != null
                  ? startMs + Number(snippet.snippet_duration_ms)
                  : startMs);
              const notesValue = notesBySnippetId[snippet.id] ?? snippet.coach_label_notes ?? "";
              return (
                <div key={snippet.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {snippet.recording_id ? `Recording ${snippet.recording_id}` : "Recording unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {snippet.id} · {snippet.source_type || "unknown source"} ·{" "}
                        {fmtMs(startMs)} - {fmtMs(endMs)}
                      </p>
                    </div>
                    <div className="rounded-md border border-border px-2 py-1 text-xs">
                      {snippet.coach_label ? `Labeled: ${snippet.coach_label}` : "Unlabeled"}
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {snippet.transcript_text || snippet.transcript || "No transcript available"}
                  </p>

                  {snippet.audio_url ? (
                    <audio controls preload="none" src={snippet.audio_url} className="mt-3 w-full" />
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No audio clip URL available.</p>
                  )}

                  <textarea
                    value={notesValue}
                    onChange={(event) =>
                      setNotesBySnippetId((prev) => ({
                        ...prev,
                        [snippet.id]: event.target.value,
                      }))
                    }
                    placeholder="Optional notes for your label"
                    className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={2}
                  />

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void setLabel(snippet, "stress")}
                      disabled={labelingId === snippet.id}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
                    >
                      Mark Stress
                    </button>
                    <button
                      type="button"
                      onClick={() => void setLabel(snippet, "no_stress")}
                      disabled={labelingId === snippet.id}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
                    >
                      Mark No Stress
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
