"use client";

import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const hasCoachFeedback = preview?.coachGrade != null || !!preview?.coachMessage;

  return (
    <Card className="w-full p-4 space-y-3 shadow-sm">
      {/* Header: date + score badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-card-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loading && !preview
              ? "Preparing report preview…"
              : "Open to see the full report."}
          </p>
        </div>
        {preview?.score != null && (
          <div className="shrink-0 rounded-md bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
            {preview.score}%
          </div>
        )}
      </div>

      {/* Coach feedback — flat, no inner border */}
      {hasCoachFeedback ? (
        <div className="flex items-start gap-2.5">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Coach Feedback</p>
            {preview?.coachGrade != null && (
              <p className="text-sm font-semibold text-card-foreground">
                Grade: {preview.coachGrade}/10
              </p>
            )}
            {preview?.coachMessage && (
              <p className="mt-0.5 text-sm text-muted-foreground whitespace-pre-wrap">
                {preview.coachMessage}
              </p>
            )}
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 h-4 w-4 shrink-0 rounded bg-muted" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        </div>
      ) : null}

      {/* CTA */}
      <Button onClick={onOpen} variant="outline" className="w-full text-sm font-medium">
        View full report
      </Button>
    </Card>
  );
}
