"use client";

import { X } from "lucide-react";

interface InsufficientCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function InsufficientCreditsModal({ open, onClose }: InsufficientCreditsModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Insufficient credits"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-sm flex-col items-center rounded-2xl bg-background p-8 shadow-xl gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-4xl">🎓</div>
        <h2 className="text-xl font-bold text-center">Not enough credits</h2>
        <p className="text-sm text-muted-foreground text-center">
          Your current credits balance is insufficient to start a homework session. Top up to continue practising.
        </p>
        <a
          href="https://buy.stripe.com/bJe28q4ch5VrfGCb9Z6wE0d"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded-xl h-12 flex items-center justify-center bg-primary text-white font-semibold text-base hover:bg-primary/90 transition-colors"
          onClick={onClose}
        >
          Top up credits
        </a>
      </div>
    </div>
  );
}
