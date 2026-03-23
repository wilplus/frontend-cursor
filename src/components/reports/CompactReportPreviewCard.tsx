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
    <div className="flex min-h-[172px] w-full flex-col rounded-lg border border-border bg-muted/20 p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading && !preview
              ? "Preparing report preview..."
              : preview
                ? "Open to see the full report."
                : "Report available."}
          </p>
        </div>
        {preview?.score != null || preview?.coachGrade != null || preview?.coachMessage ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {preview?.score != null ? (
              <div className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
                {preview.score}%
              </div>
            ) : null}
            {preview?.coachGrade != null || preview?.coachMessage ? (
              <div className="text-right text-xs font-medium text-foreground">
                {preview?.coachGrade != null ? <span>{preview.coachGrade}/10</span> : null}
                {preview?.coachMessage ? (
                  <span className={preview?.coachGrade != null ? "ml-1" : ""} aria-label="Coach message available">
                    📧
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3 min-h-[64px]">
        {preview && (preview.coachGrade != null || preview.coachMessage) ? (
          <div className="rounded-lg border border-border bg-background/70 p-3 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Coach feedback
            </p>
            {preview.coachGrade != null ? (
              <p className="mt-1 text-sm text-foreground">
                Grade: <span className="font-semibold">{preview.coachGrade}/10</span>
              </p>
            ) : null}
            {preview.coachMessage ? (
              <p className="mt-1 line-clamp-2 text-sm text-foreground">
                {preview.coachMessage}
              </p>
            ) : null}
          </div>
        ) : loading ? (
          <div className="rounded-lg border border-border bg-background/40 p-3 text-left">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="mt-2 h-3 w-16 rounded bg-muted" />
            <div className="mt-2 h-3 w-full rounded bg-muted" />
          </div>
        ) : null}
      </div>

      <Button onClick={onOpen} variant="outline" className="mt-auto h-9 w-full rounded-lg font-semibold">
        View full report
      </Button>
    </div>
  );
}
