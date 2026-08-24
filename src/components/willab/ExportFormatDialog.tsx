"use client";

import { useEffect } from "react";
import { FileText, FileType2 } from "lucide-react";
import type { PresentationExportFormat } from "@/lib/willab/presentationDocument";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";

export default function ExportFormatDialog({
  onSelect,
  onClose,
}: {
  onSelect: (format: PresentationExportFormat) => void;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-format-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-background p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="export-format-title" className="text-[20px] font-semibold">
              Export presentation
            </h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Choose the format for your presentation notes.
            </p>
          </div>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close export options" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => onSelect("pdf")}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background text-[15px] font-medium transition hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <FileText className="h-7 w-7 text-primary" aria-hidden />
            PDF
          </button>
          <button
            type="button"
            onClick={() => onSelect("docx")}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background text-[15px] font-medium transition hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <FileType2 className="h-7 w-7 text-primary" aria-hidden />
            DOCX
          </button>
        </div>
      </div>
    </div>
  );
}
