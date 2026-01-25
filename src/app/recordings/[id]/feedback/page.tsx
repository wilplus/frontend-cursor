"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitAdminFeedback, getUserAdminContext, fetchRecording } from "@/lib/api/client";
import type { AdminFeedbackRequest, UserAdminContext } from "@/lib/api/types";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import AdminAuthGuard from "@/components/admin/AdminAuthGuard";

export default function AdminFeedbackPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const recordingId = params.id as string; // Changed from recordingId to id to match route structure
  const userId = searchParams.get("user_id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingContext, setExistingContext] = useState<UserAdminContext | null>(null);
  const [recordingData, setRecordingData] = useState<any>(null);
  const [formData, setFormData] = useState<AdminFeedbackRequest>({
    user_id: userId || "",
    recording_id: recordingId,
    general_notes: "",
    custom_instructions: "",
    max_words: 120,
  });

  useEffect(() => {
    if (!userId) {
      toast.error("User ID is required");
      // Preserve current URL for redirect after login
      const currentUrl = window.location.pathname + window.location.search;
      router.push(`/login?redirectTo=${encodeURIComponent(currentUrl)}`);
      return;
    }

    loadData();
  }, [userId, recordingId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load existing admin context
      const context = await getUserAdminContext(userId!);
      setExistingContext(context);
      
      // Pre-fill form with existing data
      if (context.general_notes) {
        setFormData((prev) => ({ ...prev, general_notes: context.general_notes || "" }));
      }
      if (context.custom_instructions) {
        setFormData((prev) => ({ ...prev, custom_instructions: context.custom_instructions || "" }));
      }
      if (context.max_words) {
        setFormData((prev) => ({ ...prev, max_words: context.max_words || 120 }));
      }

      // Load recording details if available
      try {
        const recording = await fetchRecording(recordingId);
        setRecordingData(recording);
      } catch (err) {
        console.warn("Could not load recording details:", err);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load user context");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Type-safe validation with explicit checks
    const generalNotes = formData.general_notes?.trim() || "";
    const customInstructions = formData.custom_instructions?.trim() || "";
    
    if (!generalNotes || !customInstructions) {
      toast.error("General notes and custom instructions are required");
      return;
    }

    setSaving(true);
    try {
      // Ensure all required fields are present
      await submitAdminFeedback({
        ...formData,
        general_notes: generalNotes,
        custom_instructions: customInstructions,
      });
      toast.success("Feedback saved successfully!");
      setTimeout(() => {
        router.push("/admin");
      }, 1500);
    } catch (error: any) {
      console.error("Failed to save feedback:", error);
      toast.error(error.message || "Failed to save feedback");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminAuthGuard>
        <div className="min-h-screen bg-background p-8">
          <Card className="p-6">
            <p className="text-muted-foreground text-center">Loading...</p>
          </Card>
        </div>
      </AdminAuthGuard>
    );
  }

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Provide Feedback</h1>
              <p className="text-muted-foreground mt-1">
                Add feedback to improve AI analysis for this user
              </p>
            </div>
          </div>

          {/* Recording Context */}
          {recordingData && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Recording Context</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Recording ID</p>
                  <p className="text-sm font-mono">{recordingId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">User ID</p>
                  <p className="text-sm font-mono">{userId}</p>
                </div>
                {recordingData.transcription_text && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Transcription</p>
                    <p className="text-sm line-clamp-4">{recordingData.transcription_text}</p>
                  </div>
                )}
                {recordingData.analysis?.report && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Current Analysis</p>
                    <p className="text-sm line-clamp-4">{recordingData.analysis.report}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Feedback Form */}
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  General Notes <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={formData.general_notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, general_notes: e.target.value })
                  }
                  placeholder="User speaks too fast when nervous. Needs to focus on pacing and breathing techniques."
                  rows={5}
                  className="w-full p-3 border rounded-md resize-none"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  General observations about this user's speaking patterns and behavior.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Custom Instructions for AI Analysis <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={formData.custom_instructions || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, custom_instructions: e.target.value })
                  }
                  placeholder="When analyzing this user's recordings, emphasize:&#10;- Pacing and rhythm&#10;- Breathing techniques&#10;- Slowing down during key points"
                  rows={8}
                  className="w-full p-3 border rounded-md resize-none font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  These instructions will be included in the AI prompt for future analysis. Be specific about what to focus on.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Words for Analysis Report
                </label>
                <Input
                  type="number"
                  value={formData.max_words || 120}
                  onChange={(e) =>
                    setFormData({ ...formData, max_words: parseInt(e.target.value) || 120 })
                  }
                  min={50}
                  max={500}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum words for the coaching report (default: 120, range: 50-500)
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Feedback"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Existing Feedback Info */}
          {existingContext && (existingContext.general_notes || existingContext.custom_instructions) && (
            <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-semibold mb-2">Existing Feedback</h3>
              <p className="text-xs text-muted-foreground">
                You're updating existing feedback. The form above is pre-filled with current values.
              </p>
            </Card>
          )}
        </div>
      </div>
    </AdminAuthGuard>
  );
}
