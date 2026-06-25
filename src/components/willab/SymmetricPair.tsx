"use client";

/**
 * SymmetricPair — the two-button choice row used across the Lounge's post-send
 * beats (credit gate F1, joke offer F7, install prompt F2). Equal-width pills
 * that mirror the overlay Back | Next nav (see SnippetScreenShell): a grey
 * outline pill on the left (the "Back"/close affordance) and the solid orange
 * primary pill on the right (the forward action). Same h-11 rounded-full pill at
 * text-[15px] so it reads as one family with the rest of the app's navigation.
 */
export default function SymmetricPair({
  closeLabel,
  onClose,
  actionLabel,
  onAction,
}: {
  closeLabel: string;
  onClose: () => void;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-stretch gap-3">
      <button
        type="button"
        onClick={onClose}
        className="flex h-11 flex-1 items-center justify-center rounded-full border border-border text-[15px] text-foreground transition-colors hover:border-primary/50"
      >
        {closeLabel}
      </button>
      <button
        type="button"
        onClick={onAction}
        className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {actionLabel}
      </button>
    </div>
  );
}
