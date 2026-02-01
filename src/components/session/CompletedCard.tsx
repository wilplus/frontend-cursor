"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchSignedAudioUrl } from "@/lib/api/client";
import { useSessionStore } from "@/store/session-store";
import { toast } from "sonner";
import type { GetRecordingResponse } from "@/lib/api/types";

interface CompletedCardProps {
  recording: GetRecordingResponse;
}

export default function CompletedCard({ recording }: CompletedCardProps) {
  const router = useRouter();
  const reset = useSessionStore((s) => s.reset);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const isDev = process.env.NEXT_PUBLIC_ENV === "development";

  const handleFinishLesson = () => {
    reset();
    router.push("/dashboard");
  };

  useEffect(() => {
    // Check if recording has audio_url directly (from backend response)
    // @ts-ignore - audio_url might be in the recording object
    const directAudioUrl = (recording as any).audio_url;

    if (directAudioUrl) {
      // Check for dev-placeholder
      if (directAudioUrl.startsWith("dev-placeholder://") || directAudioUrl === "dev-placeholder") {
        setAudioError(true);
        setPlaybackError("Audio playback not available in development mode");
        return;
      }
      setAudioUrl(directAudioUrl);
      return;
    }

    // Otherwise, fetch signed URL
    if (isDev) {
      // Dev mode: use bundled sample
      setAudioUrl("/sample-audio.webm");
    } else {
      // Production: fetch signed URL
      setLoadingAudio(true);
      fetchSignedAudioUrl(recording.recording_id)
        .then((response) => {
          const url = response.signed_url;
          // Check for dev-placeholder in signed URL response
          if (!url || url.startsWith("dev-placeholder://")) {
            setAudioError(true);
            setPlaybackError("Audio playback not available in development mode");
            return;
          }
          setAudioUrl(url);
        })
        .catch((err) => {
          setAudioError(true);
          setPlaybackError("Failed to load audio playback");
          toast.error("Failed to load audio playback");
        })
        .finally(() => {
          setLoadingAudio(false);
        });
    }
  }, [recording.recording_id, isDev]);

  const { metrics, analysis, transcription_text } = recording;

  return (
    <Card className="p-6 space-y-6">
      <div>
        <p className="text-lg font-semibold text-primary mb-1">Good job!</p>
        <h3 className="text-lg font-semibold mb-2">Session Completed</h3>
      </div>

      {/* Report */}
      {analysis.report && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Report</h4>
          <p className="text-sm leading-relaxed">{analysis.report}</p>
        </div>
      )}

      {/* Performance Score / KPI */}
      {recording.performance_score && (
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Performance Score</h4>
            <span className="text-2xl font-bold text-primary">
              {Math.round(recording.performance_score.final_kpi * 100)}%
            </span>
          </div>
          {Object.keys(recording.performance_score.bonuses || {}).length > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              Bonuses: {Object.keys(recording.performance_score.bonuses).join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Words Per Minute</p>
          <p className="text-2xl font-bold">{metrics.wpm}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Filler Words</p>
          <p className="text-2xl font-bold">{metrics.filler_count}</p>
        </div>
      </div>

      {/* Filler Breakdown */}
      {Object.keys(metrics.filler_breakdown).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Filler Breakdown</h4>
          <div className="space-y-1">
            {Object.entries(metrics.filler_breakdown).map(([word, count]) => (
              <div key={word} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{word}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend Sentence */}
      {analysis.trend_sentence && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Key Insight</h4>
          <p className="text-sm italic text-muted-foreground">
            "{analysis.trend_sentence}"
          </p>
        </div>
      )}

      {/* Audio Playback */}
      {audioUrl && !audioError && !playbackError && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Recording</h4>
          <audio
            controls
            className="w-full"
            src={audioUrl}
            onError={(e) => {
              setPlaybackError("Failed to play audio. The file may be corrupted or unavailable.");
              setAudioError(true);
              toast.error("Failed to play audio");
            }}
            onLoadStart={() => {
              setPlaybackError(null);
            }}
          >
            Your browser does not support audio playback.
          </audio>
        </div>
      )}

      {playbackError && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {playbackError}
          </p>
        </div>
      )}

      {loadingAudio && (
        <div className="text-sm text-muted-foreground">Loading audio...</div>
      )}

      {audioError && !playbackError && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          <p>Audio playback is not available for this recording.</p>
        </div>
      )}

      {/* Transcript */}
      {transcription_text && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Transcript</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTranscript(!showTranscript)}
            >
              {showTranscript ? "Show Less" : "Show More"}
            </Button>
          </div>
          {showTranscript ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {transcription_text}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {transcription_text}
            </p>
          )}
        </div>
      )}

      <div className="border-t pt-6">
        <Button
          className="w-full"
          onClick={handleFinishLesson}
        >
          Finish the lesson and go back to your dashboard
        </Button>
      </div>
    </Card>
  );
}
