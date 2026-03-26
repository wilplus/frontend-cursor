"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface VideoModalProps {
  url: string | null;
  onClose: () => void;
}

export default function VideoModal({ url, onClose }: VideoModalProps) {
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Video"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[280px] flex-col rounded-xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="aspect-[9/16] w-full overflow-hidden rounded-t-xl bg-black">
          <iframe
            src={url}
            title="Video"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
