"use client";

import { Loader2, Paperclip } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  UploadDrop — dashed audio/video dropzone slot                             */
/*                                                                            */
/*  Tap-to-pick file slot for the "drop a recording" answer mode. Single    */
/*  rectangular dashed border so it reads as an inviting drop target on     */
/*  desktop AND a big tap target on mobile. The actual <input type="file">  */
/*  is hidden — the entire dashed box is the clickable surface so the      */
/*  user doesn't have to hit a tiny paperclip glyph.                         */
/* -------------------------------------------------------------------------- */

export interface UploadDropProps {
  /** Called with the picked file. Parent uploads it (multipart to whatever
   *  endpoint owns this surface — chat query, trial recording, etc). */
  onFile: (file: File) => void;
  /** True while the parent's upload is in flight — disables tap + shows
   *  spinner. */
  uploading?: boolean;
  /** Override the resting-state hint. Default: "Tap to upload audio or video". */
  label?: string;
  /** MIME-type filter for the native picker. Default: audio + video. */
  accept?: string;
}

export function UploadDrop({
  onFile,
  uploading = false,
  label = "Tap to upload audio or video",
  accept = "audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov",
}: UploadDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset so the same file can be re-selected after an error.
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <label
      className={cn(
        "flex h-28 w-full cursor-pointer flex-col items-center justify-center",
        "gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40",
        "text-muted-foreground transition-colors active:scale-[.99]",
        "hover:border-primary hover:bg-primary/5 hover:text-primary",
        uploading && "cursor-not-allowed opacity-60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={uploading}
        className="sr-only"
        aria-label={label}
      />
      {uploading ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      ) : (
        <Paperclip className="h-5 w-5" aria-hidden />
      )}
      <span className="text-sm font-medium">
        {uploading ? "Uploading…" : label}
      </span>
    </label>
  );
}
