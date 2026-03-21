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
    <div className="w-full rounded-lg border border-border bg-muted/20 p-4 text-left">
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
        {preview?.score != null ? (
          <div className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
            {preview.score}%
          </div>
        ) : null}
      </div>

      <Button onClick={onOpen} variant="outline" className="mt-4 h-9 w-full rounded-lg font-semibold">
        View full report
      </Button>
    </div>
  );
}
