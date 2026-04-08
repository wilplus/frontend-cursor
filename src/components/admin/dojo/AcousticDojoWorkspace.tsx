"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, SkipForward, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminApi, type AcousticDojoClip } from "@/lib/api/admin-client";

interface RecentReview {
  clipId: string;
  speaker: string;
  label: "Tremor" | "No Tremor" | "Skipped";
}

function getSpeakerLabel(clip: AcousticDojoClip): string {
  const speaker =
    typeof clip.source_metadata?.speaker_label === "string" ? clip.source_metadata.speaker_label : null;
  if (speaker) return speaker;
  if (clip.student_id) return clip.student_id.slice(0, 10);
  return "unknown-speaker";
}

function getAiScore(clip: AcousticDojoClip | null): number {
  if (!clip) return 73;
  const raw = clip.source_metadata?.ai_score;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const normalized = raw <= 1 ? raw * 100 : raw;
    return Math.max(0, Math.min(100, Math.round(normalized)));
  }
  return 73;
}

function getPlaybackWindow(clip: AcousticDojoClip): string {
  const start =
    typeof clip.source_metadata?.clip_start_sec === "number"
      ? clip.source_metadata.clip_start_sec
      : typeof clip.source_metadata?.start_sec === "number"
        ? clip.source_metadata.start_sec
        : null;
  const end =
    typeof clip.source_metadata?.clip_end_sec === "number"
      ? clip.source_metadata.clip_end_sec
      : typeof clip.source_metadata?.end_sec === "number"
        ? clip.source_metadata.end_sec
        : null;
  if (start != null && end != null) {
    return `${start.toFixed(1)}s — ${end.toFixed(1)}s`;
  }
  if (clip.duration_sec != null) {
    const startFallback = Math.max(0, clip.duration_sec - 10);
    return `${startFallback.toFixed(1)}s — ${clip.duration_sec.toFixed(1)}s`;
  }
  return "—";
}

export default function AcousticDojoWorkspace({ showHeader = true }: { showHeader?: boolean }) {
  const [clips, setClips] = useState<AcousticDojoClip[]>([]);
  const [reviewerId, setReviewerId] = useState("admin");
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadClips = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAcousticDojoNextClips({ limit: 6 });
      setClips(response.clips ?? []);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load dojo clips");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClips();
  }, [loadClips]);

  const currentClip = useMemo(() => clips[0] ?? null, [clips]);
  const totalInSession = sessionReviewed + clips.length;
  const currentIndex = totalInSession === 0 ? 0 : Math.min(sessionReviewed + 1, totalInSession);
  const progressPercent =
    totalInSession === 0 ? 0 : Math.round((currentIndex / totalInSession) * 100);

  const submitAnswer = useCallback(async (hasTremor: boolean) => {
    if (!currentClip) return;
    const trimmedReviewer = reviewerId.trim();
    if (!trimmedReviewer) {
      toast.error("Reviewer ID is required.");
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.submitAcousticDojoLabel({
        clip_id: currentClip.clip_id,
        source_metadata: currentClip.source_metadata ?? {},
        label_stress: hasTremor,
        label_charisma: false,
        confidence: Math.max(1, Math.min(5, Math.round(getAiScore(currentClip) / 20))),
        labeled_by: trimmedReviewer,
      });
      setSessionReviewed((previous) => previous + 1);
      const reviewLabel: RecentReview["label"] = hasTremor ? "Tremor" : "No Tremor";
      setRecentReviews((previous) => [
        {
          clipId: currentClip.clip_id,
          speaker: getSpeakerLabel(currentClip),
          label: reviewLabel,
        },
        ...previous,
      ].slice(0, 8));
      setClips((previous) => previous.slice(1));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to submit clip label");
    } finally {
      setSubmitting(false);
    }
  }, [currentClip, reviewerId]);

  const skipClip = useCallback(() => {
    if (!currentClip) return;
    setRecentReviews((previous) => [
      {
        clipId: currentClip.clip_id,
        speaker: getSpeakerLabel(currentClip),
        label: "Skipped",
      },
      ...previous,
    ].slice(0, 8));
    setClips((previous) => previous.slice(1));
  }, [currentClip]);

  return (
    <div className="space-y-5 animate-fade-in-short">
      {showHeader ? (
        <div>
          <h1 className="text-2xl font-semibold">Acoustic Dojo</h1>
          <p className="text-sm text-muted-foreground">
            Audio-only clip labeling for stress/charisma with confidence scores.
          </p>
        </div>
      ) : null}

      <div className="mx-auto max-w-[760px] space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{currentIndex} of {totalInSession} clips reviewed</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-foreground transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <Card className="space-y-5 border-border/80 bg-card/95 p-0">
          {loading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading next clips...</p>
          ) : currentClip == null ? (
            <p className="rounded-md border border-dashed m-5 p-4 text-sm text-muted-foreground">
              No clips available right now.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h2 className="text-3xl font-semibold tracking-tight">Tremor / Nervousness</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  AI: {getAiScore(currentClip)}%
                </span>
              </div>

              <div className="space-y-5 px-5 pb-5">
                <div className="rounded-xl border bg-muted/20 p-5">
                  <div className="mb-4 flex justify-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-2xl">🔉</div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    {getSpeakerLabel(currentClip)} · {getPlaybackWindow(currentClip)}
                  </p>
                  {currentClip.audio_url ? (
                    <audio key={currentClip.clip_id} controls className="mt-3 w-full" src={currentClip.audio_url} />
                  ) : (
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div className="h-2 w-1/3 rounded-full bg-amber-300" />
                    </div>
                  )}
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    Audio playback (mock — connect real audio source)
                  </p>
                </div>

                <p className="text-center text-2xl font-semibold">
                  Do you hear vocal tremor or nervousness in this clip?
                </p>

                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    className="h-14 min-w-[120px] text-xl"
                    onClick={() => void submitAnswer(false)}
                    disabled={submitting}
                  >
                    <X className="mr-2 h-4 w-4" />
                    No
                  </Button>
                  <Button
                    className="h-14 min-w-[120px] bg-emerald-600 text-xl hover:bg-emerald-700"
                    onClick={() => void submitAnswer(true)}
                    disabled={submitting}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Yes
                  </Button>
                </div>

                <div className="flex justify-center">
                  <Button variant="ghost" className="text-base" onClick={skipClip} disabled={submitting}>
                    <SkipForward className="mr-2 h-4 w-4" />
                    Skip
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span>Keyboard:</span>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5">←</kbd>
                  <span>No</span>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5">→</kbd>
                  <span>Yes</span>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5">Space</kbd>
                  <span>Skip</span>
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
                <div key={`${item.clipId}-${item.label}`} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span className="text-base">{item.label}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{item.speaker}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Hidden input keeps current reviewer ID configurable while staying off-surface. */}
        <input
          value={reviewerId}
          onChange={(event) => setReviewerId(event.target.value)}
          className="sr-only"
          aria-hidden
        />
      </div>
    </div>
  );
}
