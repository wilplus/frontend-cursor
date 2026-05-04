"use client";

import { useState } from "react";
import { Loader2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AdminShell from "@/components/admin/AdminShell";
import { getAuthToken } from "@/lib/api/auth-client";

interface SnippetMetrics {
  wpm?: number | null;
  pause_ms?: number | null;
  dynamic_db?: number | null;
  emphasis_per_min?: number | null;
  energy_ratio?: number | null;
  pitch_center_st?: number | null;
  pitch_frame_count?: number | null;
  voiced_duration_sec?: number | null;
}

interface Snippet {
  id: string;
  session_id: string;
  user_id: string;
  recording_id: string;
  start_offset_ms: number;
  duration_ms: number;
  audio_segment_path: string;
  snippet_type: string;
  admin_comment: string | null;
  admin_user_id: string | null;
  metrics: SnippetMetrics | null;
  created_at: string;
  updated_at: string;
}

interface SnippetEdit {
  [snippetId: string]: {
    comment: string;
    type: string;
  };
}

/** Format a metric value for display. */
function fmt(val: number | null | undefined, unit: string, decimals = 1): string {
  if (val == null) return "—";
  return `${val.toFixed(decimals)}${unit}`;
}

/** Renders a single metric pill. */
function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border bg-muted/30 px-3 py-2 text-center">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

/** Renders the metrics grid for a snippet. */
function SnippetMetricsBar({ metrics }: { metrics: SnippetMetrics | null }) {
  if (!metrics) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No acoustic metrics available for this snippet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {metrics.wpm != null && (
        <MetricPill label="WPM" value={fmt(metrics.wpm, "", 0)} />
      )}
      <MetricPill label="Pause" value={fmt(metrics.pause_ms, " ms", 0)} />
      <MetricPill label="Dynamic dB" value={fmt(metrics.dynamic_db, " dB")} />
      <MetricPill label="Emphasis" value={fmt(metrics.emphasis_per_min, "/min")} />
      <MetricPill label="Pitch" value={fmt(metrics.pitch_center_st, " st")} />
      <MetricPill label="Energy" value={fmt(metrics.energy_ratio, "", 2)} />
    </div>
  );
}

export default function AdminSnippetsPage() {
  const [filterMode, setFilterMode] = useState<"user" | "session">("user");
  const [filterValue, setFilterValue] = useState("");
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<SnippetEdit>({});
  const [error, setError] = useState<string | null>(null);

  const fetchSnippets = async () => {
    if (!filterValue.trim()) {
      setError(`Please enter a ${filterMode === "user" ? "user" : "session"} ID`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError("Not authenticated. Please log in.");
        setLoading(false);
        return;
      }

      const url =
        filterMode === "user"
          ? `/api/v2/admin/users/${filterValue.trim()}/snippets`
          : `/api/v2/admin/users/${filterValue.trim()}/snippets`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch snippets");
      const data = await response.json();
      setSnippets(data.snippets || []);

      // Initialize edits with current values
      const initialEdits: SnippetEdit = {};
      (data.snippets || []).forEach((snippet: Snippet) => {
        initialEdits[snippet.id] = {
          comment: snippet.admin_comment || "",
          type: snippet.snippet_type,
        };
      });
      setEdits(initialEdits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error fetching snippets");
    } finally {
      setLoading(false);
    }
  };

  const saveSnippet = async (snippetId: string) => {
    setSavingId(snippetId);
    setSavedId(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError("Not authenticated. Please log in.");
        setSavingId(null);
        return;
      }

      const response = await fetch(`/api/v2/admin/snippets/${snippetId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          admin_comment: edits[snippetId].comment || null,
          snippet_type: edits[snippetId].type,
        }),
      });

      if (!response.ok) throw new Error("Failed to save snippet");
      const data = await response.json();

      // Update snippet in list
      setSnippets((prev) =>
        prev.map((s) => (s.id === snippetId ? data.snippet : s))
      );
      setSavedId(snippetId);
      setTimeout(() => setSavedId(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving snippet");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Snippet Management</h1>
          <p className="text-sm text-muted-foreground">
            Review acoustic metrics, label snippets, and add feedback.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as "user" | "session")}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="user">Filter by User ID</option>
              <option value="session">Filter by Session ID</option>
            </select>
            <Input
              placeholder={
                filterMode === "user" ? "Enter user UUID" : "Enter session UUID"
              }
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchSnippets()}
              className="flex-1"
            />
            <Button onClick={fetchSnippets} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Results count */}
        {!loading && snippets.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {snippets.length} snippet{snippets.length !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Snippets List */}
        <div className="space-y-6">
          {snippets.map((snippet) => (
            <div
              key={snippet.id}
              className="rounded-lg border bg-card p-6 space-y-4"
            >
              {/* Row 1: Audio + Type Selector */}
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                {/* Audio Player */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Audio
                  </p>
                  <audio
                    src={snippet.audio_segment_path}
                    controls
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Duration: {(snippet.duration_ms / 1000).toFixed(1)}s
                    {" · "}Session: {snippet.session_id.slice(0, 8)}...
                  </p>
                </div>

                {/* Type Selector */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Snippet Type
                  </label>
                  <select
                    value={edits[snippet.id]?.type || "unlabeled"}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [snippet.id]: {
                          ...prev[snippet.id],
                          type: e.target.value,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="charisma">Charisma</option>
                    <option value="stress">Stress</option>
                    <option value="unlabeled">Unlabeled</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Acoustic Metrics (pre-computed, read from DB) */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Acoustic Metrics
                </p>
                <SnippetMetricsBar metrics={snippet.metrics} />
              </div>

              {/* Row 3: Comment Input */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Admin Comment
                </label>
                <textarea
                  value={edits[snippet.id]?.comment || ""}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [snippet.id]: {
                        ...prev[snippet.id],
                        comment: e.target.value,
                      },
                    }))
                  }
                  placeholder="Add feedback for this snippet..."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveSnippet(snippet.id)}
                  disabled={savingId === snippet.id}
                  className="gap-2"
                >
                  {savingId === snippet.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : savedId === snippet.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savedId === snippet.id ? "Saved" : "Save"}
                </Button>
              </div>
            </div>
          ))}

          {!loading && snippets.length === 0 && filterValue && (
            <div className="rounded-lg border border-dashed bg-muted/50 p-8 text-center text-muted-foreground">
              No snippets found for this {filterMode === "user" ? "user" : "session"}.
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
