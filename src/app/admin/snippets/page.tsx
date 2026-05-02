"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AdminShell from "@/components/admin/AdminShell";
import { getAuthToken } from "@/lib/api/auth-client";

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
  created_at: string;
  updated_at: string;
}

interface SnippetEdit {
  [snippetId: string]: {
    comment: string;
    type: string;
  };
}

export default function AdminSnippetsPage() {
  const [userId, setUserId] = useState("");
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<SnippetEdit>({});
  const [error, setError] = useState<string | null>(null);

  const fetchSnippets = async () => {
    if (!userId.trim()) {
      setError("Please enter a user ID");
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

      const response = await fetch(`/api/v2/admin/users/${userId}/snippets`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    setSaving(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError("Not authenticated. Please log in.");
        setSaving(false);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving snippet");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="Snippet Management" description="Review and label charisma snippets">
      <div className="space-y-6">
        {/* User Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">User ID</label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter user UUID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchSnippets()}
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

        {/* Snippets Grid */}
        <div className="space-y-6">
          {snippets.map((snippet) => (
            <div
              key={snippet.id}
              className="rounded-lg border bg-card p-6 space-y-4"
            >
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
                    Duration: {(snippet.duration_ms / 1000).toFixed(1)}s · Offset:{" "}
                    {(snippet.start_offset_ms / 1000).toFixed(1)}s
                  </p>
                </div>

                {/* Type Selector */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Snippet Type
                  </label>
                  <Select
                    value={edits[snippet.id]?.type || "unlabeled"}
                    onValueChange={(value) =>
                      setEdits((prev) => ({
                        ...prev,
                        [snippet.id]: {
                          ...prev[snippet.id],
                          type: value,
                        },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="charisma">Charisma</SelectItem>
                      <SelectItem value="stress">Stress</SelectItem>
                      <SelectItem value="unlabeled">Unlabeled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Comment Input */}
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
                  disabled={saving}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          ))}

          {!loading && snippets.length === 0 && userId && (
            <div className="rounded-lg border border-dashed bg-muted/50 p-8 text-center text-muted-foreground">
              No snippets found for this user.
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
