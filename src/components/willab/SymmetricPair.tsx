"use client";

/**
 * SymmetricPair — the two-button choice row used across the Lounge's post-send
 * beats (legacy joke offer F7, install prompt F2). Equal-width pills
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
  tone = "primary",
}: {
  closeLabel: string;
  onClose: () => void;
  actionLabel: string;
  onAction: () => void;
  /** "dark": the black pill of the record button (the WhatsApp offer's Save). */
  tone?: "primary" | "dark";
}) {
  const actionColors =
    tone === "dark"
      ? "bg-foreground text-background hover:bg-foreground/90"
      : "bg-primary text-primary-foreground hover:bg-primary/90";
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
        className={`flex h-11 flex-1 items-center justify-center rounded-full text-[15px] font-medium transition-colors ${actionColors}`}
      >
        {actionLabel}
      </button>
    </div>
  );
}
