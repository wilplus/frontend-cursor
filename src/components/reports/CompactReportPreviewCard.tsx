"use client";

import { Button } from "@/components/ui/button";
import type { CompactReportPreview } from "@/lib/reports/compact-preview";

type CompactReportPreviewCardProps = {
  title: string;
  preview: CompactReportPreview | null;
  loading?: boolean;
  onOpen: () => void;
};

export default function CompactReportPreviewCard({
  title,
  preview,
  loading = false,
  onOpen,
}: CompactReportPreviewCardProps) {
  return (
    <div className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>

      {loading && !preview ? (
        <p className="text-sm text-muted-foreground">Loading report preview…</p>
      ) : preview ? (
        <div className="space-y-4">
          {preview.score != null ? (
            <div className="rounded-lg bg-muted/40 px-4 py-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Performance score
              </p>
              <p className="mt-1 text-2xl font-semibold text-primary">{preview.score}%</p>
            </div>
          ) : null}

          <div className="space-y-0 text-sm">
            <div className="grid grid-cols-[88px_1fr] items-center border-b border-border py-2">
              <p className="text-muted-foreground">Playback</p>
              <p className="text-right text-primary">
                {preview.playbackUrl ? "Open recording" : "Not available yet"}
              </p>
            </div>
            <div className="grid grid-cols-[88px_1fr] items-center border-b border-border py-2">
              <p className="text-muted-foreground">Transcript</p>
              <p className="text-right italic text-muted-foreground">
                {preview.transcriptExcerpt ? `“${preview.transcriptExcerpt}”` : "Not available yet"}
              </p>
            </div>
            <div className="grid grid-cols-[88px_1fr] items-center py-2">
              <p className="text-muted-foreground">Filler words</p>
              <p className="text-right text-foreground">
                {preview.fillerTotal != null ? (
                  <>
                    {preview.fillerTotal}
                    {preview.fillerBreakdownText ? (
                      <span className="text-muted-foreground"> · {preview.fillerBreakdownText}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">Not available yet</span>
                )}
              </p>
            </div>
          </div>

          <div className="rounded-lg border-l-2 border-l-primary bg-muted/30 px-4 py-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              AI Coach Insight
            </p>
            <p className="text-sm leading-relaxed text-foreground/80">
              {preview.aiInsight || "Still loading…"}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Report preview not available yet.</p>
      )}

      <Button onClick={onOpen} className="mt-4 h-10 w-full rounded-lg font-semibold">
        View full report
      </Button>
    </div>
  );
}
