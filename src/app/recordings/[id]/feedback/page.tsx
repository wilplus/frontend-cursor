"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitAdminFeedback, getUserAdminContext, getAuthUserEmail, fetchRecording } from "@/lib/api/client";
import type { AdminFeedbackRequest, UserAdminContext } from "@/lib/api/types";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import AdminAuthGuard from "@/components/admin/AdminAuthGuard";
import { createClient } from "@/lib/supabase/client";

export default function AdminFeedbackPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const recordingId = params.id as string; // Changed from recordingId to id to match route structure
  const userId = searchParams.get("user_id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingContext, setExistingContext] = useState<UserAdminContext | null>(null);
  const [displayEmail, setDisplayEmail] = useState<string | null>(null);
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
      // Preserve current URL for redirect after login (including all query params)
      const currentUrl = window.location.pathname + window.location.search;
      const loginUrl = `/login?redirectTo=${encodeURIComponent(currentUrl)}`;
      console.log("[Feedback Page] Redirecting to login, preserving URL:", currentUrl);
      router.push(loginUrl);
      return;
    }

    // Only load data if we have both IDs
    if (recordingId && userId) {
      loadData();
    }
  }, [userId, recordingId, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load existing admin context
      const context = await getUserAdminContext(userId!);
      setExistingContext(context);
      setDisplayEmail(context?.user_email?.trim() || null);
      if (!context?.user_email?.trim()) {
        try {
          const { email } = await getAuthUserEmail(userId!);
          if (email?.trim()) setDisplayEmail(email.trim());
        } catch {
          // ignore
        }
      }

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
        console.log("[Feedback Page] Recording data loaded:", {
          hasAnalysis: !!recording.analysis?.report,
          hasMetrics: !!recording.metrics,
          hasPerformanceScore: !!recording.performance_score,
        });
        setRecordingData(recording);
      } catch (err: any) {
        console.error("Could not load recording details:", err);
        // Don't show error toast - just log it, page can still be used for feedback
        if (err.message?.includes("401") || err.message?.includes("Session expired")) {
          toast.error("Session expired. Please refresh the page and try again.");
        }
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
      // Refresh session server-side before submitting to ensure cookies are updated
      try {
        const refreshRes = await fetch("/api/auth/confirm-session", {
          method: "POST",
          credentials: "include", // Important: include cookies
        });
        
        if (!refreshRes.ok) {
          console.warn("[Feedback] Session refresh failed, but continuing with submission");
        } else {
          console.log("[Feedback] Session confirmed/refreshed server-side");
        }
      } catch (refreshErr) {
        console.warn("[Feedback] Error refreshing session:", refreshErr);
        // Continue anyway - the BFF will handle it
      }

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
      
      // Handle session expiration specifically
      if (error.message?.includes("Session expired") || 
          error.message?.includes("401") || 
          error.message?.includes("UNAUTHORIZED")) {
        toast.error("Your session has expired. Redirecting to login...", {
          duration: 5000,
        });
        // Redirect to login after a delay
        setTimeout(() => {
          const currentUrl = window.location.pathname + window.location.search;
          router.push(`/login?redirectTo=${encodeURIComponent(currentUrl)}`);
        }, 2000);
      } else {
        toast.error(error.message || "Failed to save feedback");
      }
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
              {displayEmail && (
                <p className="mt-2 text-sm">
                  <span className="font-medium text-foreground">User email: </span>
                  <span className="font-mono text-foreground">{displayEmail}</span>
                </p>
              )}
            </div>
          </div>

          {/* Recording Analysis - Full Report for Admin Review */}
          {recordingData && (
            <div className="space-y-4">
              {/* Full AI Analysis Report */}
              {recordingData.analysis?.report && (
                <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <h2 className="text-xl font-semibold mb-3 text-blue-900 dark:text-blue-100">
                    AI Analysis Report
                  </h2>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-blue-800 dark:text-blue-200">
                      {recordingData.analysis.report}
                    </p>
                  </div>
                  {recordingData.analysis.trend_sentence && (
                    <div className="mt-4 pt-4 border-t border-blue-300 dark:border-blue-700">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Trend Analysis</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {recordingData.analysis.trend_sentence}
                      </p>
                    </div>
                  )}
                </Card>
              )}

              {/* Recording Metrics */}
              {recordingData.metrics && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Words/Min</p>
                      <p className="text-lg font-semibold">{Math.round(recordingData.metrics.wpm || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Filler Words</p>
                      <p className="text-lg font-semibold">{recordingData.metrics.filler_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Duration</p>
                      <p className="text-lg font-semibold">
                        {Math.round(recordingData.metrics.duration_seconds || 0)}s
                      </p>
                    </div>
                    {recordingData.metrics.pacing_score !== undefined && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Pacing Score</p>
                        <p className="text-lg font-semibold">
                          {(recordingData.metrics.pacing_score * 100).toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                  {recordingData.metrics.filler_breakdown && 
                   Object.keys(recordingData.metrics.filler_breakdown).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Filler Word Breakdown</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(recordingData.metrics.filler_breakdown).map(([word, count]) => (
                          <span
                            key={word}
                            className="px-2 py-1 bg-muted rounded text-xs"
                          >
                            {word}: {count as number}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Performance Score */}
              {recordingData.performance_score && (
                <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <h3 className="text-lg font-semibold mb-4 text-green-900 dark:text-green-100">
                    Performance Score
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Overall Performance</p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {(recordingData.performance_score.performance * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Final KPI</p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {(recordingData.performance_score.final_kpi * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  {recordingData.performance_score.bonuses && 
                   Object.values(recordingData.performance_score.bonuses).some((v: any) => v && typeof v === 'number' && v > 0) && (
                    <div className="pt-4 border-t border-green-300 dark:border-green-700">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Bonuses Applied</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(recordingData.performance_score.bonuses).map(([key, value]) => {
                          const numValue = typeof value === 'number' ? value : 0;
                          return numValue > 0 ? (
                            <span key={key} className="px-2 py-1 bg-green-200 dark:bg-green-800 rounded text-xs">
                              {key}: +{(numValue * 100).toFixed(1)}%
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Transcription */}
              {recordingData.transcription_text && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Full Transcription</h3>
                  <div className="bg-muted p-4 rounded-md max-h-64 overflow-y-auto">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {recordingData.transcription_text}
                    </p>
                  </div>
                </Card>
              )}

              {/* Recording Metadata */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recording Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Recording ID</p>
                    <p className="text-sm font-mono break-all">{recordingId}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">User ID</p>
                    <p className="text-sm font-mono break-all">{userId}</p>
                  </div>
                  {recordingData.session_id && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Session ID</p>
                      <p className="text-sm font-mono break-all">{recordingData.session_id}</p>
                    </div>
                  )}
                  {recordingData.created_at && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Created At</p>
                      <p className="text-sm">
                        {new Date(recordingData.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
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
              {displayEmail && (
                <p className="text-sm mt-2">
                  <span className="font-medium text-foreground">User email: </span>
                  <span className="font-mono text-foreground">{displayEmail}</span>
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </AdminAuthGuard>
  );
}
