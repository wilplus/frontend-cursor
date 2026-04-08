"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminApi, type AcousticDojoClip } from "@/lib/api/admin-client";

interface LeaderboardRow {
  labeled_by: string;
  labels_count: number;
}

function getClipTitle(clip: AcousticDojoClip): string {
  const sourceTitle =
    typeof clip.source_metadata?.source_title === "string" ? clip.source_metadata.source_title : null;
  const speaker =
    typeof clip.source_metadata?.speaker_label === "string" ? clip.source_metadata.speaker_label : null;
  return sourceTitle || speaker || clip.clip_id;
}

export default function AcousticDojoWorkspace({ showHeader = true }: { showHeader?: boolean }) {
  const [clips, setClips] = useState<AcousticDojoClip[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [reviewerId, setReviewerId] = useState("admin");
  const [stress, setStress] = useState(false);
  const [charisma, setCharisma] = useState(false);
  const [confidence, setConfidence] = useState(3);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadClips = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAcousticDojoNextClips({ limit: 5 });
      setClips(response.clips ?? []);
      setStreak(response.streak ?? 0);
      setTodayCount(response.today_count ?? 0);
      setLeaderboard(response.leaderboard ?? []);
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

  const submitLabel = useCallback(async () => {
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
        label_stress: stress,
        label_charisma: charisma,
        confidence,
        labeled_by: trimmedReviewer,
      });
      toast.success("Label submitted.");
      setStress(false);
      setCharisma(false);
      setConfidence(3);
      await loadClips();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to submit clip label");
    } finally {
      setSubmitting(false);
    }
  }, [charisma, confidence, currentClip, loadClips, reviewerId, stress]);

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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="space-y-4 border-border/80 bg-card/85 p-4 shadow-sm">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading next clips...</p>
          ) : currentClip == null ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No clips available right now.
            </p>
          ) : (
            <>
              <div className="animate-fade-in-short space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Current Clip
                </p>
                <h2 className="text-xl font-semibold tracking-tight">{getClipTitle(currentClip)}</h2>
                <p className="text-xs leading-5 text-muted-foreground">
                  Source: {currentClip.source_type} | Duration: {currentClip.duration_sec ?? "-"}s
                </p>
              </div>

              {currentClip.audio_url ? (
                <audio key={currentClip.clip_id} controls className="w-full" src={currentClip.audio_url} />
              ) : (
                <p className="text-sm text-muted-foreground">No playback URL available for this clip.</p>
              )}

              <div className="grid gap-3 rounded-xl border border-border/80 bg-background/60 p-3.5 shadow-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-border/80 px-3 text-sm transition-colors hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={stress}
                      onChange={(event) => setStress(event.target.checked)}
                      disabled={submitting}
                    />
                    Stress
                  </label>
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-border/80 px-3 text-sm transition-colors hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={charisma}
                      onChange={(event) => setCharisma(event.target.checked)}
                      disabled={submitting}
                    />
                    Charisma
                  </label>
                </div>

                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Confidence: {confidence}</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={confidence}
                    onChange={(event) => setConfidence(Number(event.target.value))}
                    disabled={submitting}
                    className="w-full accent-primary"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Labeled by</span>
                  <Input
                    value={reviewerId}
                    onChange={(event) => setReviewerId(event.target.value)}
                    disabled={submitting}
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => void loadClips()} disabled={loading || submitting}>
                    Refresh
                  </Button>
                  <Button onClick={() => void submitLabel()} disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit label"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card className="space-y-3 border-border/80 bg-card/85 p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Session Stats</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-border/80 bg-background/60 p-2.5 transition-transform duration-200 hover:-translate-y-0.5">
              <p className="text-xs text-muted-foreground">Streak</p>
              <p className="text-lg font-semibold">{streak}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 p-2.5 transition-transform duration-200 hover:-translate-y-0.5">
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-lg font-semibold">{todayCount}</p>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Leaderboard</p>
            <div className="space-y-1">
              {leaderboard.length === 0 ? (
                <p className="text-xs text-muted-foreground">No labels yet.</p>
              ) : (
                leaderboard.slice(0, 8).map((row) => (
                  <div
                    key={`${row.labeled_by}-${row.labels_count}`}
                    className="flex h-8 items-center justify-between rounded-lg border border-border/80 bg-background/60 px-2.5 text-xs transition-colors hover:bg-muted/40"
                  >
                    <span className="truncate">{row.labeled_by}</span>
                    <span>{row.labels_count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
